// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Busca de Propriedade por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma visão detalhada
 * de uma propriedade específica, identificada pelo seu ID.
 *
 * A consulta é segura e otimizada, garantindo em uma única operação que:
 * 1.  Apenas usuários autenticados possam acessar o endpoint.
 * 2.  Apenas membros da propriedade possam visualizar seus detalhes.
 * 3.  Os dados retornados (incluindo caminhos de arquivos) estão no formato
 * exato que a aplicação front-end espera consumir.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'propertyAccess.log';

// Schema para validar o ID da propriedade recebido via parâmetros da URL.
const getPropertyByIdSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'O ID da propriedade fornecido é inválido.',
    }),
});

/**
 * Processa a requisição para buscar os detalhes de uma propriedade específica.
 */
export const getPropertyById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;
    const { id: propertyId } = getPropertyByIdSchema.parse(req.params);

    // --- 2. Busca e Autorização em uma Única Consulta (Desempenho e Segurança) ---
    // A consulta busca a propriedade pelo ID e, ao mesmo tempo, verifica se o
    // usuário requisitante está na lista de membros, combinando busca e autorização.
    const property = await prisma.propriedades.findFirst({
      where: {
        id: propertyId,
        usuarios: {
          some: {
            idUsuario: userId,
          },
        },
      },
      select: {
        // Campos diretos da propriedade, incluindo os do novo fluxo
        id: true, nomePropriedade: true, tipo: true, dataCadastro: true, valorEstimado: true,
        enderecoCep: true, enderecoCidade: true, enderecoBairro: true, enderecoLogradouro: true,
        enderecoNumero: true, enderecoComplemento: true, enderecoPontoReferencia: true,
        duracaoMinimaEstadia: true, duracaoMaximaEstadia: true, horarioCheckin: true,
        horarioCheckout: true, prazoCancelamentoReserva: true, limiteFeriadosPorCotista: true,
        limiteReservasAtivasPorCotista: true, totalFracoes: true, diariasPorFracao: true,

        // Relações incluídas seletivamente
        fotos: { 
          select: { id: true, documento: true }, 
          where: { excludedAt: null }
        },
        documentos: { 
          select: { id: true, tipoDocumento: true, documento: true }, 
          where: { excludedAt: null }
        },
        usuarios: {
          where: { usuario: { excludedAt: null } },
          select: {
            id: true,
            permissao: true,
            numeroDeFracoes: true,
            saldoDiariasAtual: true,
            usuario: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Se o resultado for nulo, significa que ou a propriedade não existe, ou o
    // usuário não tem permissão para vê-la.
    if (!property) {
      return res.status(404).json({ success: false, message: 'Propriedade não encontrada ou acesso negado.' });
    }
    
    // --- 3. Envio da Resposta de Sucesso ---
    // Os caminhos para fotos e documentos são retornados de forma relativa.
    return res.status(200).json({
      success: true,
      message: 'Propriedade recuperada com sucesso.',
      data: property,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    // Registra qualquer erro inesperado para fins de monitoramento.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar propriedade por ID: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar a propriedade.',
    });
  }
};