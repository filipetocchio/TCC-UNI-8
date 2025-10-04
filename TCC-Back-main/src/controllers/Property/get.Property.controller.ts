// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getPropertySchema = z.object({
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 10).refine(v => v > 0, { message: 'Limit must be a positive number.' }),
  page: z.string().optional().transform(v => v ? parseInt(v, 10) : 1).refine(v => v > 0, { message: 'Page must be a positive number.' }),
  search: z.string().optional(),
  showDeleted: z.enum(['true','false','only']).optional().default('false'),
  sortBy: z.enum(['dataCadastro','valorEstimado','nomePropriedade']).optional().default('dataCadastro'),
  sortOrder: z.enum(['asc','desc']).optional().default('desc'),
});

export const getProperty = async (req: Request, res: Response) => {
  try {
    const { limit, page, search, showDeleted, sortBy, sortOrder } = getPropertySchema.parse(req.query);
    console.log('getProperty params:', { limit, page, search, showDeleted, sortBy, sortOrder });

    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { nomePropriedade: { contains: search, mode: 'insensitive' } },
        { enderecoCep:       { contains: search, mode: 'insensitive' } },
        { enderecoCidade:    { contains: search, mode: 'insensitive' } },
        { enderecoBairro:    { contains: search, mode: 'insensitive' } },
        { enderecoLogradouro:{ contains: search, mode: 'insensitive' } },
        { tipo:              { contains: search, mode: 'insensitive' } },
        { documento:         { contains: search, mode: 'insensitive' } },
      ];
    }
    if (showDeleted === 'false')      where.excludedAt = null;
    else if (showDeleted === 'only')  where.excludedAt = { not: null };

    const orderBy = { [sortBy]: sortOrder };

    const [properties, total] = await Promise.all([
      prisma.propriedades.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          nomePropriedade: true,
          tipo: true,
          dataCadastro: true,
          usuarios: { select: { usuario: { select: { id: true, nomeCompleto: true } }, permissao: true } },
          fotos:    { select: { id: true, documento: true } },
        },
      }),
      prisma.propriedades.count({ where }),
    ]);
    console.log('Fetched properties count:', properties.length);

    const formatted = properties.map(p => {
      const usuarios = p.usuarios.map(u => ({ id: u.usuario.id, nomeCompleto: u.usuario.nomeCompleto, permissao: u.permissao }));
      console.log(`Property ${p.id} usuarios:`, usuarios);
      return { ...p, usuarios };
    });

    const totalPages = Math.ceil(total / limit);
    return res.json({ success: true, message: 'Propriedades recuperadas.', data: { properties: formatted, pagination: { page, limit, total, totalPages } } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('Validation error in getProperty:', err.issues);
      return res.status(400).json({ success: false, message: err.issues[0].message });
    }
    console.error('Error in getProperty:', err);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
};