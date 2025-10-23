import { getIronSession } from 'iron-session';
import { defaultSession } from '../models/session.js';

import type { IronSession, SessionOptions } from 'iron-session';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SessionData } from '../models/session.js';

export const sessionOptions: SessionOptions = {
    password: process.env.NT_IRON_SESSION_SECRET!,
    cookieName: process.env.NODE_ENV === 'production' ?  '__Secure-nighttune-session' : 'nighttune-session',
    cookieOptions: {
        domain: process.env.NT_IRON_SESSION_COOKIE_DOMAIN,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    },
};

export async function getSession(request: IncomingMessage | Request, response: Response | ServerResponse<IncomingMessage>): Promise<IronSession<SessionData>> {
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (session.turnstileTestPassed === undefined) {
        session.turnstileTestPassed = defaultSession.turnstileTestPassed;
    }

    return session;
};