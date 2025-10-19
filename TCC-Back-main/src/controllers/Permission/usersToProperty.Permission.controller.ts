// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Vínculo em Massa de Usuários a Propriedades (Administrativo)
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint administrativo que cria múltiplos
 * vínculos entre usuários e propriedades em uma única requisição. A operação é
 * atômica, segura e otimizada para performance.
 *
 * ####################################################################
 * #                                                                  #
 * #   N O T A   D E   S E G U R A N Ç A   E   R O T E A M E N T O    #
 * #                                                                  #
 * ####################################################################
 *
 * Este controlador executa uma operação de alta privilégio. É CRUCIAL que a
 * rota que o utiliza seja configurada com middlewares `protect` e `verifyRoles`
 * para garantir que apenas usuários com nível de **Administrador** possam acessá-la.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';
import { createNotification } from '../../utils/notification.service';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'permission.log';

// --- Schemas de Validação ---

// Schema para um único objeto de vínculo, agora incluindo o número de frações.
const linkUserSchema = z.object({
  idPropriedade: z.number().int().positive(),
  idUsuario: z.number().int().positive(),
  permissao: z.enum(['proprietario_master', 'proprietario_comum']),
  numeroDeFracoes: z.number().int().min(0).optional().default(0),
});

// Schema para o corpo da requisição, que deve ser um array de vínculos.
const linkUsersSchema = z.array(linkUserSchema).min(1, 'Pelo menos um vínculo deve ser fornecido.');

/**
 * Processa a criação em massa de vínculos entre usuários e propriedades.
 */
export const linkUserPermission = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: authorId, nomeCompleto: authorName } = req.user;
    const vinculosParaCriar = linkUsersSchema.parse(req.body);

    // --- 2. Execução da Lógica Transacional ---
    const resultado = await prisma.$transaction(async (tx) => {
      // 2.1. Coleta e Busca de Dados em Massa (Desempenho)
      const idsDeUsuario = [...new Set(vinculosParaCriar.map(v => v.idUsuario))];
      const idsDePropriedade = [...new Set(vinculosParaCriar.map(v => v.idPropriedade))];

      const [usuariosExistentes, propriedadesExistentes, vinculosExistentes] = await Promise.all([
        tx.user.findMany({ where: { id: { in: idsDeUsuario } }, select: { id: true, nomeCompleto: true } }),
        tx.propriedades.findMany({ where: { id: { in: idsDePropriedade } }, select: { id: true, nomePropriedade: true, totalFracoes: true, diariasPorFracao: true } }),
        tx.usuariosPropriedades.findMany({ where: { idPropriedade: { in: idsDePropriedade } } }),
      ]);

      // 2.2. Validação Cruzada em Memória (Segurança e Integridade)
      const errosDeValidacao: string[] = [];
      const mapaUsuarios = new Map(usuariosExistentes.map(u => [u.id, u]));
      const mapaPropriedades = new Map(propriedadesExistentes.map(p => [p.id, p]));
      const mapaVinculos = new Set(vinculosExistentes.map(v => `${v.idUsuario}-${v.idPropriedade}`));
      
      // Agrupa as novas frações por propriedade para validar o total.
      const novasFracoesPorPropriedade = new Map<number, number>();

      vinculosParaCriar.forEach((vinculo, index) => {
        if (!mapaUsuarios.has(vinculo.idUsuario)) errosDeValidacao.push(`Item ${index}: Usuário ID ${vinculo.idUsuario} não encontrado.`);
        if (!mapaPropriedades.has(vinculo.idPropriedade)) errosDeValidacao.push(`Item ${index}: Propriedade ID ${vinculo.idPropriedade} não encontrada.`);
        if (mapaVinculos.has(`${vinculo.idUsuario}-${vinculo.idPropriedade}`)) errosDeValidacao.push(`Item ${index}: O usuário ${vinculo.idUsuario} já está vinculado à propriedade ${vinculo.idPropriedade}.`);
        
        // Acumula as novas frações a serem adicionadas por propriedade.
        const totalAtual = novasFracoesPorPropriedade.get(vinculo.idPropriedade) || 0;
        novasFracoesPorPropriedade.set(vinculo.idPropriedade, totalAtual + vinculo.numeroDeFracoes);
      });

      // Valida se a soma das frações (existentes + novas) não excede o limite da propriedade.
      for (const [idPropriedade, novasFracoes] of novasFracoesPorPropriedade.entries()) {
        const propriedade = mapaPropriedades.get(idPropriedade);
        if (propriedade) {
          const fracoesExistentes = vinculosExistentes.filter(v => v.idPropriedade === idPropriedade).reduce((sum, v) => sum + v.numeroDeFracoes, 0);
          if (fracoesExistentes + novasFracoes > propriedade.totalFracoes) {
            errosDeValidacao.push(`Propriedade '${propriedade.nomePropriedade}' (ID ${idPropriedade}): A soma das frações (${fracoesExistentes + novasFracoes}) excederia o limite total de ${propriedade.totalFracoes}.`);
          }
        }
      }

      if (errosDeValidacao.length > 0) {
        throw new Error(errosDeValidacao.join(' '));
      }

      // 2.3. Cálculo do Saldo de Diárias (Pro-Rata) e Preparação dos Dados
      const hoje = new Date();
      const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);
      const fimDoAno = new Date(hoje.getFullYear(), 11, 31);
      const diasTotaisNoAno = (fimDoAno.getTime() - inicioDoAno.getTime()) / (1000 * 3600 * 24) + 1;
      const diasRestantesNoAno = (fimDoAno.getTime() - hoje.getTime()) / (1000 * 3600 * 24) + 1;
      const proporcaoAnoRestante = diasRestantesNoAno > 0 ? diasRestantesNoAno / diasTotaisNoAno : 0;

      const dataParaCriar = vinculosParaCriar.map(v => {
        const propriedade = mapaPropriedades.get(v.idPropriedade)!;
        const saldoAnualTotal = v.numeroDeFracoes * propriedade.diariasPorFracao;
        const saldoProRata = saldoAnualTotal * proporcaoAnoRestante;
        
        return {
          ...v,
          dataVinculo: new Date(),
          saldoDiariasAtual: saldoProRata,
        };
      });

      // 2.4. Criação em Massa dos Novos Vínculos (Desempenho)
      const resultadoCriacao = await tx.usuariosPropriedades.createMany({ data: dataParaCriar });

      // Retorna os dados necessários para as notificações.
      return { count: resultadoCriacao.count, usuarios: mapaUsuarios, propriedades: mapaPropriedades };
    });

    // --- 3. Disparo de Notificações (Desempenho) ---
    vinculosParaCriar.forEach(vinculo => {
      const usuario = resultado.usuarios.get(vinculo.idUsuario);
      const propriedade = resultado.propriedades.get(vinculo.idPropriedade);
      if (usuario && propriedade) {
        createNotification({
          idPropriedade: vinculo.idPropriedade,
          idAutor: authorId,
          mensagem: `O usuário '${usuario.nomeCompleto}' foi adicionado à propriedade '${propriedade.nomePropriedade}' por '${authorName}'.`,
        }).catch(err => logEvents(`Falha ao criar notificação para vínculo: ${err.message}`, LOG_FILE));
      }
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: `${resultado.count} vínculo(s) criado(s) com sucesso.`,
      data: { count: resultado.count },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao criar vínculos em massa: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao criar os vínculos.',
    });
  }
};