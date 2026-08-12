import mongoose, { Document, Schema } from 'mongoose';

/**
 * @interface IGenerationJob
 * @extends {Document}
 * @description Tracks the lifecycle of an AI document generation task, mapping source inputs to compiled assets.
 */
export interface IGenerationJob extends Document {
  /** The user who triggered the generation job */
  user: mongoose.Types.ObjectId;
  /** The project workspace associated with this job */
  project: mongoose.Types.ObjectId;
  /** The reference asset used as the document template */
  templateAsset: mongoose.Types.ObjectId;
  /** The reference asset containing the source text/data parsed by the AI */
  sourceAsset: mongoose.Types.ObjectId;
  /** Current execution status of the job */
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** The resulting compiled files generated upon successful completion */
  result?: {
    docxAsset: mongoose.Types.ObjectId;
    pdfAsset?: mongoose.Types.ObjectId;
  };
  /** Error message if the generation job failed */
  error?: string;
  /** Job creation timestamp */
  createdAt: Date;
  /** Job update timestamp */
  updatedAt: Date;
}

const GenerationJobSchema = new Schema<IGenerationJob>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    templateAsset: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    sourceAsset: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    result: {
      docxAsset: { type: Schema.Types.ObjectId, ref: 'Asset' },
      pdfAsset: { type: Schema.Types.ObjectId, ref: 'Asset' },
    },
    error: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

// High-performance index to fetch a project's recent generation jobs quickly
GenerationJobSchema.index({ project: 1, createdAt: -1 });

export const GenerationJob = mongoose.model<IGenerationJob>(
  'GenerationJob',
  GenerationJobSchema
);
