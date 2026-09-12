import { Router } from 'express';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';
import {
  createProject,
  getProjects,
  getProjectDetails,
  updateProject,
  deleteProject
} from './controllers/project.controller.ts';

const router = Router();

/**
 * System-wide middleware for the project module.
 * Every route below this line strictly requires a valid, authenticated JWT session.
 */
router.use(authenticate);

/**
 * @route GET /
 * @description Fetches the user's project list.
 * @access Protected
 */
router.get('/', getProjects);

/**
 * @route GET /:projectId
 * @description Fetches a specific project dashboard along with associated assets and AI generation jobs.
 * @access Protected
 */
router.get('/:projectId', getProjectDetails);

/**
 * @route POST /
 * @description Initializes a new blank project workspace.
 * @access Protected + CSRF
 */
router.post('/', csrfProtection, createProject);

/**
 * @route PATCH /:projectId
 * @description Renames an existing project workspace.
 * @access Protected + CSRF
 */
router.patch('/:projectId', csrfProtection, updateProject);


/**
 * @route DELETE /:projectId
 * @description Deletes a project workspace.
 * @access Protected + CSRF
 */
router.delete('/:projectId', csrfProtection, deleteProject)


export default router; 