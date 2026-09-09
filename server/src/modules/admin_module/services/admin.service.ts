import { User } from '../../authentication_module/models/Users.model.ts';
import { Project } from '../../project_module/models/Project.model.ts';
import { PaymentOrder } from '../../payment_module/models/PaymentOrder.model.ts';
import { GenerationJob } from '../../template_engine_module/models/GenerationJob.model.ts';
import { addCredits } from '../../credits_module/services/credits.service.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('admin-service');

export async function getSystemStats() {
  const [
    totalUsers,
    totalProjects,
    totalGenerations,
    paidOrders,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments(),
    Project.countDocuments(),
    GenerationJob.countDocuments(),
    PaymentOrder.find({ status: 'paid' }).select('amount currency'),
    User.find().select('-passwordHash').sort({ createdAt: -1 }).limit(5),
  ]);

  const totalRevenuePaise = paidOrders.reduce((sum, order) => sum + order.amount, 0);

  return {
    overview: {
      totalUsers,
      totalProjects,
      totalGenerations,
      totalPaidOrdersCount: paidOrders.length,
      totalRevenueINR: totalRevenuePaise / 100,
    },
    recentUsers,
  };
}

export async function getUsersList(page = 1, limit = 20, search?: string) {
  const skip = (page - 1) * limit;
  const query = search
    ? {
        $or: [
          { email: new RegExp(search, 'i') },
          { name: new RegExp(search, 'i') },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function grantUserCreditsAdmin(
  targetUserId: string,
  amount: number,
  adminUserId: string
) {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) throw new Error('Target user not found');

  const newBalance = await addCredits(
    targetUserId,
    amount,
    'admin_grant',
    `Manual credit grant by Admin (${adminUserId})`
  );

  log.info({ targetUserId, amount, adminUserId }, 'Admin granted credits to user');
  return { targetUserId, amountGranted: amount, newBalance };
}
