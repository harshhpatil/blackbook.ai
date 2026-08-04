import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { authenticate } from '../middlewares/auth.middleware.ts';
import { csrfProtection } from '../middlewares/csrf.middleware.ts';
import { Project } from '../models/Project.model.ts';
import { Asset } from '../models/Asset.model.ts';
import { GenerationJob } from '../models/GenerationJob.model.ts';

const router = Router();
router.use(authenticate);

router.post('/', csrfProtection, async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 160) return res.status(400).json({ message: 'title must be 1 to 160 characters' });
    const project = await Project.create({ userId: req.user.id, title });
    return res.status(201).json({ project });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    return res.json({ projects });
  } catch (error) { next(error); }
});

router.get('/:projectId', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.projectId)) return res.status(404).json({ message: 'project not found' });
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user.id });
    if (!project) return res.status(404).json({ message: 'project not found' });
    const assets = await Asset.find({ project: project._id, owner: req.user.id }).sort({ createdAt: -1 });
    const generationJobs = await GenerationJob.find({ project: project._id, user: req.user.id }).sort({ createdAt: -1 }).limit(20);
    return res.json({ project, assets, generationJobs });
  } catch (error) { next(error); }
});

router.patch('/:projectId', csrfProtection, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.projectId)) return res.status(404).json({ message: 'project not found' });
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 160) return res.status(400).json({ message: 'title must be 1 to 160 characters' });
    const project = await Project.findOneAndUpdate(
      { _id: req.params.projectId, userId: req.user.id },
      { $set: { title } },
      { new: true }
    );
    if (!project) return res.status(404).json({ message: 'project not found' });
    return res.json({ project });
  } catch (error) { next(error); }
});

export default router;
