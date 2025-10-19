// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Upload de Documentos de Propriedades
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que gerencia o upload de um novo
 * documento para uma propriedade específica. O processo é seguro e otimizado
 * para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é 'proprietario_master').
 * 2.  Verificar se a propriedade de destino existe.
 * 3.  Criar um novo registro para o documento no banco de dados.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'documentUpload.log';

// Schema para validar os dados recebidos no corpo da requisição (multipart/form-data).
const uploadSchema = z.object({
  idPropriedade: z.string().transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: 'O ID da propriedade é inválido.' }),
  tipoDocumento: z.string().min(1, { message: 'O tipo do documento é obrigatório.' }),
});

/**
 * Processa o upload de um novo documento para uma propriedade.
 */
export const uploadPropertyDocument = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    
    const { idPropriedade, tipoDocumento } = uploadSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de documento foi enviado.' });
    }

    // --- 2. Verificação de Autorização e Existência da Propriedade (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    // Esta consulta também valida que a propriedade existe, otimizando a operação.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade,
            idUsuario: userId,
            permissao: 'proprietario_master'
        },
        include: {
            propriedade: true // Inclui os dados da propriedade para a notificação
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas proprietários master podem adicionar documentos.'
        });
    }
    const { propriedade } = userPermission;
    
    // --- 3. Criação do Registro do Documento no Banco de Dados ---
    const { filename } = req.file;
    const url = `/uploads/documents/${filename}`;

    const newDocument = await prisma.documentoPropriedade.create({
      data: {
        idPropriedade,
        tipoDocumento,
        documento: url,
      },
    });

    // --- 4. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' adicionou um novo documento ('${tipoDocumento}') à propriedade '${propriedade.nomePropriedade}'.`,
    }).catch(err => {
      // Se a criação da notificação falhar, apenas registra o erro em background.
      logEvents(`Falha ao criar notificação para upload de documento: ${err.message}`, LOG_FILE);
    });

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: 'Documento enviado com sucesso.',
      data: newDocument,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao fazer upload de documento: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ 
        success: false, 
        message: "Ocorreu um erro inesperado no servidor ao enviar o documento." 
    });
  }
};