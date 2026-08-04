import mongoose, { Document, Schema } from 'mongoose';

export interface IGenerationJob extends Document {
  user: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  templateAsset: mongoose.Types.ObjectId;
  sourceAsset: mongoose.Types.ObjectId;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: { docxAsset: mongoose.Types.ObjectId; pdfAsset?: mongoose.Types.ObjectId };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GenerationJobSchema = new Schema<IGenerationJob>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    templateAsset: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    sourceAsset: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued', index: true },
    result: {
      docxAsset: { type: Schema.Types.ObjectId, ref: 'Asset' },
      pdfAsset: { type: Schema.Types.ObjectId, ref: 'Asset' },
    },
    error: { type: String, maxlength: 1_000 },
  },
  { timestamps: true }
);

GenerationJobSchema.index({ project: 1, createdAt: -1 });

export const GenerationJob = mongoose.model<IGenerationJob>('GenerationJob', GenerationJobSchema);
