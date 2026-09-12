import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface IProject
 * @extends {Document}
 * @description Represents a workspace for a user's AI generations.
 */
export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  contentData: Record<string, unknown>;
  downloads: {
    pdfUrl?: string;
    docxUrl?: string;
  };
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160, default: 'Untitled Blackbook' },
    status: {
      type: String,
      enum: ['draft', 'processing', 'completed', 'failed'],
      default: 'draft',
      index: true,
    },
    contentData: { type: Schema.Types.Mixed, default: {} },
    downloads: {
      pdfUrl: { type: String },
      docxUrl: { type: String },
    },
    lastError: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

// High-performance index for fetching a user's recent projects
projectSchema.index({ userId: 1, updatedAt: -1 });

export const Project = mongoose.model<IProject>('Project', projectSchema);