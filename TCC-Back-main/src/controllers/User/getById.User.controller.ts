// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import { z } from "zod";

// Definição do schema para validar os parâmetros da requisição
const getUserByIdSchema = z.object({
  id: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: "ID must be a positive number." }),
});

const getUserById = async (req: Request, res: Response) => {
  try {
    // Validando o parâmetro ID usando o schema
    const { id } = getUserByIdSchema.parse(req.params);

    // Definindo o domínio completo para a URL
    const domain = req.protocol + '://' + req.get('host'); // Isso pega o protocolo (http/https) e o host (domínio)

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        telefone: true,
        dataCadastro: true,
        userPhoto: { select: { url: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado.",
        message: "Usuário não encontrado.",
      });
    }

    // Se o usuário tem foto, adiciona a URL completa
    if (user.userPhoto?.url) {
      user.userPhoto.url = domain + user.userPhoto.url; // Adiciona o domínio ao caminho da foto
    }

    return res.status(200).json({
      success: true,
      message: "Usuário recuperado com sucesso.",
      data: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        message: error.errors[0].message,
      });
    }
    console.error("Erro no getUserById:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor.",
      message: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
  }
};

export { getUserById };
