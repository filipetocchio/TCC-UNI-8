// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Upload de Fotos de Propriedades
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que salva as informações de uma
 * foto de propriedade no banco de dados, após o arquivo ter sido processado por
 * um middleware de upload. O processo é seguro e otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é master da propriedade).
 * 2.  Verificar se a propriedade de destino existe.
 * 3.  Criar um novo registro para a foto no banco de dados.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'photoUpload.log';

// Schema para validar os dados recebidos no corpo da requisição (multipart/form-data).
const uploadPhotoSchema = z.object({
  idPropriedade: z.string().transform((val) => parseInt(val, 10)),
});

/**
 * Processa a criação de um registro de foto de propriedade após o upload do arquivo.
 */
export const uploadPropertyPhoto = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de foto foi enviado.' });
    }

    const { idPropriedade } = uploadPhotoSchema.parse(req.body);

    // --- 2. Verificação de Autorização e Existência da Propriedade (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    // Esta consulta também valida que a propriedade existe.
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
            message: 'Acesso negado. Apenas proprietários master podem adicionar fotos.'
        });
    }
    const { propriedade } = userPermission;

    // --- 3. Criação do Registro da Foto no Banco de Dados ---
    const url = `/uploads/property/${req.file.filename}`;

    const foto = await prisma.fotoPropriedade.create({
      data: {
        idPropriedade,
        documento: url, // O campo 'documento' armazena o caminho do arquivo da foto.
      },
    });

    // --- 4. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' adicionou uma nova foto à propriedade '${propriedade.nomePropriedade}'.`,
    }).catch(err => {
        logEvents(`Falha ao criar notificação para upload de foto: ${err.message}`, LOG_FILE);
    });

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: 'Foto enviada com sucesso.',
      data: foto,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao salvar foto de propriedade: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ 
        success: false, 
        message: 'Ocorreu um erro inesperado no servidor ao salvar a foto.' 
    });
  }
};