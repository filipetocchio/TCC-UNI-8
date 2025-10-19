// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Dados da Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint de atualização dos detalhes de uma
 * propriedade. O processo é seguro, transacional e otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é 'proprietario_master').
 * 2.  Aplicar atualizações parciais nos dados da propriedade.
 * 3.  Se o número total de frações for alterado, o sistema recalcula atomicamente
 * o direito a diárias por fração e atualiza o saldo de todos os cotistas.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';
import { Prisma } from '@prisma/client';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'property.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// --- Schemas de Validação ---

const paramsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

const updatePropertySchema = z.object({
  nomePropriedade: z.string().min(1, { message: 'O nome da propriedade é obrigatório.' }).optional(),
  enderecoCep: z.string().optional().refine((val) => !val || /^\d{8}$/.test(val), { message: 'O CEP deve ter 8 dígitos.' }),
  enderecoCidade: z.string().optional(),
  enderecoBairro: z.string().optional(),
  enderecoLogradouro: z.string().optional(),
  enderecoNumero: z.string().optional(),
  enderecoComplemento: z.string().optional(),
  enderecoPontoReferencia: z.string().optional(),
  tipo: z.enum(['Casa', 'Apartamento', 'Chacara', 'Lote', 'Outros']).optional(),
  valorEstimado: z.preprocess(
    (val) => {
      if (typeof val === 'string' && val.trim() !== '') {
        return parseFloat(val.replace(/\./g, '').replace(',', '.'));
      }
      return val;
    },
    z.number().positive({ message: 'O valor estimado deve ser um número positivo.' }).nullable().optional()
  ),
  totalFracoes: z.number().int().min(1, "O total de frações deve ser no mínimo 1.").max(52, "O total de frações não pode exceder 52.").optional(),
});

/**
 * Processa a atualização dos dados de uma propriedade e notifica os membros.
 */
export const updateProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { id: propertyId } = paramsSchema.parse(req.params);
    const dataToUpdate = updatePropertySchema.parse(req.body);

    // --- 2. Execução da Lógica Transacional de Atualização ---
    const updatedProperty = await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Busca e Validação da Propriedade e da Permissão do Usuário
      const userPermission = await tx.usuariosPropriedades.findFirst({
        where: { idPropriedade: propertyId, idUsuario: userId, permissao: 'proprietario_master' },
        include: { propriedade: true },
      });

      if (!userPermission || userPermission.propriedade.excludedAt) {
        throw new Error('Acesso negado, a propriedade não foi encontrada ou você não tem permissão.');
      }
      
      const { propriedade: currentProperty } = userPermission;
      const dataForPropertyUpdate: Prisma.PropriedadesUpdateInput = { ...dataToUpdate };

      // 2.2. Lógica Condicional para Recálculo de Frações e Saldos
      // Esta lógica só é executada se o total de frações for alterado.
      if (dataToUpdate.totalFracoes && dataToUpdate.totalFracoes !== currentProperty.totalFracoes) {
        // Regra de segurança: impede que o total de frações seja menor que o número de cotistas com frações.
        const cotistasComFracao = await tx.usuariosPropriedades.count({
          where: { idPropriedade: propertyId, numeroDeFracoes: { gt: 0 } },
        });
        if (dataToUpdate.totalFracoes < cotistasComFracao) {
          throw new Error(`Não é possível definir o total de frações para ${dataToUpdate.totalFracoes}, pois já existem ${cotistasComFracao} cotistas com frações distribuídas.`);
        }

        // Calcula e inclui o novo valor de diárias por fração na atualização.
        const newDiariasPorFracao = 365 / dataToUpdate.totalFracoes;
        dataForPropertyUpdate.diariasPorFracao = newDiariasPorFracao;
        
        // Busca todos os membros para recalcular seus saldos.
        const members = await tx.usuariosPropriedades.findMany({ where: { idPropriedade: propertyId } });
        
        // Prepara as atualizações de saldo em paralelo para máxima performance.
        const balanceUpdatePromises = members.map(member => {
          const newBalance = member.numeroDeFracoes * newDiariasPorFracao;
          
          return tx.usuariosPropriedades.update({
            where: { id: member.id },
            data: { saldoDiariasAtual: newBalance },
          });
        });
        
        // Executa todas as atualizações de saldo.
        await Promise.all(balanceUpdatePromises);
      }
      
      // 2.3. Execução da Atualização Principal da Propriedade
      return tx.propriedades.update({
        where: { id: propertyId },
        data: dataForPropertyUpdate,
      });
    });

    // --- 3. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade: propertyId,
      idAutor: userId,
      mensagem: `O usuário '${userName}' atualizou as informações da propriedade '${updatedProperty.nomePropriedade}'.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para atualização de propriedade: ${err.message}`, LOG_FILE);
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Propriedade atualizada com sucesso.',
      data: updatedProperty,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao atualizar propriedade: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor.' });
  }
};