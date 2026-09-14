// src/app/api/logout/route.ts
import { SESSAO_COOKIE_NOME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSAO_COOKIE_NOME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    return response;
}
