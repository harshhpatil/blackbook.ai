import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { Project } from '../models/Project.model.ts';
// Cross-module imports for the aggregate view
import { Asset } from '../../assets_module/models/Asset.model.ts';
import { GenerationJob } from '../../template_engine_module/models/GenerationJob.model.ts';

/**
 * @function createProject
 * @description Creates a new workspace (project) for the authenticated user.
 *
 * @param {Request} req - Express request object containing the project title.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<Response | void>} Resolves with the created project data.
 */
export async function createProject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const title =
      typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 160) {
      return res
        .status(400)
        .json({ message: 'Title must be 1 to 160 characters' });
    }

    const project = await Project.create({ userId: req.user!.id, title });
    return res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
}

/**
 * @function getProjects
 * @description Retrieves all projects owned by the authenticated user, sorted by most recently updated.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<Response | void>} Resolves with an array of project documents.
 */
export async function getProjects(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projects = await Project.find({ userId: req.user!.id }).sort({
      updatedAt: -1,
    });
    return res.json({ projects });
  } catch (error) {
    next(error);
  }
}

/**
 * @function getProjectDetails
 * @description Aggregates a comprehensive dashboard view of a specific project, including its associated assets and recent generation jobs.
 *
 * @param {Request} req - Express request object containing the projectId parameter.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<Response | void>} Resolves with the project data, assets array, and recent jobs array.
 */
export async function getProjectDetails(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isValidObjectId(req.params.projectId)) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = await Project.findOne({
      _id: req.params.projectId,
      userId: req.user!.id,
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Fetch related assets and jobs for the project dashboard
    const assets = await Asset.find({
      project: project._id,
      owner: req.user!.id,
    }).sort({ createdAt: -1 });
    const generationJobs = await GenerationJob.find({
      project: project._id,
      user: req.user!.id,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({ project, assets, generationJobs });
  } catch (error) {
    next(error);
  }
}

/**
 * @function updateProject
 * @description Modifies the title of an existing project. Strictly validates ownership before updating.
 *
 * @param {Request} req - Express request object containing the projectId parameter and new title body.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<Response | void>} Resolves with the updated project data.
 */
export async function updateProject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isValidObjectId(req.params.projectId)) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const title =
      typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 160) {
      return res
        .status(400)
        .json({ message: 'Title must be 1 to 160 characters' });
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.projectId, userId: req.user!.id },
      { $set: { title } },
      { new: true }
    );

    if (!project) return res.status(404).json({ message: 'Project not found' });
    return res.json({ project });
  } catch (error) {
    next(error);
  }
}

export const deleteProject = async (req: Request, res: Response) => {
  const { projectId } = req.params;

  // Find and delete the project. Make sure it belongs to the logged-in user!
  const deleted = await Project.findOneAndDelete({
    _id: projectId,
    userId: req.user.id,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Project not found' });
  }

  // Return a 200 OK or 204 No Content
  return res.status(200).json({ message: 'Project deleted successfully' });
};
