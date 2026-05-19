import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/response';

export async function meController(req: Request, res: Response) {
  sendSuccess(res, 'Profile fetched', req.user);
}
