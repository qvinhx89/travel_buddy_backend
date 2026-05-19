import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/response';
import { loginWithGoogle } from './auth.service';

export async function googleLoginController(req: Request, res: Response) {
  const data = await loginWithGoogle(req.body);
  sendSuccess(res, 'Login successful', data);
}
