import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/response';
import { loginWithGoogle, logout, refreshAuth } from './auth.service';

export async function googleLoginController(req: Request, res: Response) {
  const data = await loginWithGoogle(req.body);
  sendSuccess(res, 'Login successful', data);
}

export async function refreshController(req: Request, res: Response) {
  const data = await refreshAuth(req.body);
  sendSuccess(res, 'Token refreshed', data);
}

export async function logoutController(req: Request, res: Response) {
  await logout(req.body);
  sendSuccess(res, 'Logout successful', null);
}
