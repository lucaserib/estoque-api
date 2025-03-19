import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// Categorias de produtos para dar mais organização aos dados
const CATEGORIAS = [
  "Eletrônicos",
  "Escritório",
  "Ferramentas",
  "Informática",
  "Papelaria",
];

// Configurações
const PRODUTOS_COUNT = 20; // Quantidade de produtos simples a criar
const KITS_COUNT = 5; // Quantidade de kits a criar
const FORNECEDORES_COUNT = 5; // Quantidade de fornecedores
const ARMAZENS_COUNT = 2; // Quantidade de armazéns
const PEDIDOS_COUNT = 8; // Quantidade de pedidos de compra
const SAIDAS_COUNT = 10; // Quantidade de saídas
const CONFIRMAR_PEDIDOS = 5; // Quantos pedidos devem ser confirmados

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // Criar ou encontrar usuário de teste
  const userEmail = "lfscaffa@gmail.com";
  const userName = "Usuário Teste";
  const userPassword = "teste123";

  let user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    console.log(`👤 Criando usuário de teste: ${userEmail}`);
    const hashedPassword = await hash(userPassword, 10);
    user = await prisma.user.create({
      data: {
        email: userEmail,
        name: userName,
        password: hashedPassword,
      },
    });
  } else {
    console.log(`👤 Usuário já existe: ${userEmail}`);
  }

  // Criar fornecedores
  console.log("🏭 Criando fornecedores...");
  const fornecedores = [];
  for (let i = 1; i <= FORNECEDORES_COUNT; i++) {
    const fornecedor = await prisma.fornecedor.create({
      data: {
        nome: `Fornecedor ${i}`,
        cnpj: `${10000000000000 + i}`,
        inscricaoEstadual: `IE${100000 + i}`,
        contato: `contato@fornecedor${i}.com`,
        endereco: `Rua dos Fornecedores, ${i * 100}`,
        userId: user.id,
      },
    });
    fornecedores.push(fornecedor);
    console.log(`  ✓ Criado fornecedor: ${fornecedor.nome}`);
  }

  // Criar armazéns
  console.log("🏪 Criando armazéns...");
  const armazens = [];
  for (let i = 1; i <= ARMAZENS_COUNT; i++) {
    const armazem = await prisma.armazem.create({
      data: {
        nome: `Armazém ${i}`,
        userId: user.id,
      },
    });
    armazens.push(armazem);
    console.log(`  ✓ Criado armazém: ${armazem.nome}`);
  }

  // Criar produtos simples
  console.log("📦 Criando produtos simples...");
  const produtos = [];
  for (let i = 1; i <= PRODUTOS_COUNT; i++) {
    const categoria = CATEGORIAS[Math.floor(Math.random() * CATEGORIAS.length)];
    const custoMedio = Math.floor(Math.random() * 10000) + 500; // Valor em centavos entre 5 e 105
    const produto = await prisma.produto.create({
      data: {
        nome: `${categoria} - Produto ${i}`,
        sku: `SKU-${categoria.substring(0, 3).toUpperCase()}-${1000 + i}`,
        ean: BigInt(`780${i.toString().padStart(10, "0")}`),
        custoMedio: custoMedio,
        isKit: false,
        userId: user.id,
      },
    });
    produtos.push(produto);
    console.log(`  ✓ Criado produto: ${produto.nome} (SKU: ${produto.sku})`);

    // Adicionar estoque para este produto em cada armazém
    for (const armazem of armazens) {
      const quantidade = Math.floor(Math.random() * 100) + 1;
      const estoqueSeguranca = Math.floor(quantidade * 0.2); // 20% do estoque como segurança

      await prisma.estoque.create({
        data: {
          produtoId: produto.id,
          armazemId: armazem.id,
          quantidade: quantidade,
          estoqueSeguranca: estoqueSeguranca,
        },
      });
    }

    // Criar relação produto-fornecedor para alguns fornecedores
    const numFornecedores = Math.floor(Math.random() * 3) + 1; // 1 a 3 fornecedores por produto
    const fornecedoresSelecionados = shuffleArray([...fornecedores]).slice(
      0,
      numFornecedores
    );

    for (const fornecedor of fornecedoresSelecionados) {
      const preco = Math.floor(custoMedio * (0.8 + Math.random() * 0.4)); // Variação de -20% a +20% do custo médio
      const multiplicador =
        Math.random() < 0.3 ? Math.floor(Math.random() * 5) + 2 : 1; // 30% chance de ter multiplicador > 1

      await prisma.produtoFornecedor.create({
        data: {
          produtoId: produto.id,
          fornecedorId: fornecedor.id,
          preco: preco,
          multiplicador: multiplicador,
          codigoNF: `NF-${fornecedor.id}-${produto.id}`,
        },
      });
    }
  }

  // Criar kits
  console.log("🎁 Criando kits...");
  const kits = [];
  for (let i = 1; i <= KITS_COUNT; i++) {
    const categoria = CATEGORIAS[Math.floor(Math.random() * CATEGORIAS.length)];
    const kit = await prisma.produto.create({
      data: {
        nome: `Kit ${categoria} ${i}`,
        sku: `KIT-${categoria.substring(0, 3).toUpperCase()}-${i}`,
        ean: BigInt(`790${i.toString().padStart(10, "0")}`),
        isKit: true,
        userId: user.id,
      },
    });
    kits.push(kit);
    console.log(`  ✓ Criado kit: ${kit.nome} (SKU: ${kit.sku})`);

    // Adicionar componentes ao kit (2-4 produtos por kit)
    const numComponentes = Math.floor(Math.random() * 3) + 2;
    const componentesProdutos = shuffleArray([...produtos]).slice(
      0,
      numComponentes
    );

    for (const produto of componentesProdutos) {
      const quantidade = Math.floor(Math.random() * 3) + 1;
      await prisma.componente.create({
        data: {
          kitId: kit.id,
          produtoId: produto.id,
          quantidade: quantidade,
        },
      });
    }

    // Adicionar estoque para este kit em cada armazém
    for (const armazem of armazens) {
      const quantidade = Math.floor(Math.random() * 30) + 1;
      const estoqueSeguranca = Math.floor(quantidade * 0.2);

      await prisma.estoque.create({
        data: {
          produtoId: kit.id,
          armazemId: armazem.id,
          quantidade: quantidade,
          estoqueSeguranca: estoqueSeguranca,
        },
      });
    }
  }

  // Criar pedidos de compra
  console.log("📝 Criando pedidos de compra...");
  const pedidos = [];
  const todosProdutos = [...produtos, ...kits];

  for (let i = 1; i <= PEDIDOS_COUNT; i++) {
    const fornecedor =
      fornecedores[Math.floor(Math.random() * fornecedores.length)];
    const dataPrevista = new Date();
    dataPrevista.setDate(
      dataPrevista.getDate() + Math.floor(Math.random() * 30)
    );

    const pedido = await prisma.pedidoCompra.create({
      data: {
        fornecedorId: fornecedor.id,
        comentarios: `Pedido #${i} - Observações de teste`,
        status: i <= CONFIRMAR_PEDIDOS ? "confirmado" : "pendente",
        dataPrevista: dataPrevista,
        dataConclusao: i <= CONFIRMAR_PEDIDOS ? new Date() : null,
        armazemId: i <= CONFIRMAR_PEDIDOS ? armazens[0].id : null,
        userId: user.id,
      },
    });
    pedidos.push(pedido);
    console.log(`  ✓ Criado pedido: #${pedido.id} (${pedido.status})`);

    // Adicionar produtos ao pedido
    const numProdutosPedido = Math.floor(Math.random() * 5) + 1;
    const produtosPedido = shuffleArray([...todosProdutos]).slice(
      0,
      numProdutosPedido
    );

    for (const produto of produtosPedido) {
      const quantidade = Math.floor(Math.random() * 10) + 1;
      const custo = Math.floor(Math.random() * 10000) + 500; // 5 a 105 reais em centavos
      const multiplicador =
        Math.random() < 0.2 ? Math.floor(Math.random() * 5) + 2 : 1;

      await prisma.pedidoProduto.create({
        data: {
          pedidoId: pedido.id,
          produtoId: produto.id,
          quantidade: quantidade,
          custo: custo,
          multiplicador: multiplicador,
        },
      });

      // Se o pedido foi confirmado, atualizar o estoque
      if (i <= CONFIRMAR_PEDIDOS) {
        // Verificar se já existe estoque
        const estoqueExistente = await prisma.estoque.findFirst({
          where: {
            produtoId: produto.id,
            armazemId: armazens[0].id,
          },
        });

        if (estoqueExistente) {
          await prisma.estoque.update({
            where: {
              produtoId_armazemId: {
                produtoId: produto.id,
                armazemId: armazens[0].id,
              },
            },
            data: {
              quantidade: {
                increment: quantidade * multiplicador,
              },
            },
          });
        } else {
          await prisma.estoque.create({
            data: {
              produtoId: produto.id,
              armazemId: armazens[0].id,
              quantidade: quantidade * multiplicador,
              estoqueSeguranca: Math.floor(quantidade * multiplicador * 0.2),
            },
          });
        }

        // Atualizar custo médio
        await prisma.produto.update({
          where: { id: produto.id },
          data: { custoMedio: custo },
        });
      }
    }
  }

  // Criar registros de saída
  console.log("🚚 Criando registros de saída...");
  for (let i = 1; i <= SAIDAS_COUNT; i++) {
    const armazem = armazens[Math.floor(Math.random() * armazens.length)];
    const dataPassada = new Date();
    dataPassada.setDate(dataPassada.getDate() - Math.floor(Math.random() * 30));

    const saida = await prisma.saida.create({
      data: {
        userId: user.id,
        armazemId: armazem.id,
        data: dataPassada,
      },
    });
    console.log(`  ✓ Criada saída: #${saida.id}`);

    // Adicionar detalhes da saída (1-3 produtos)
    const numProdutosSaida = Math.floor(Math.random() * 3) + 1;
    const produtosSaida = shuffleArray([...todosProdutos]).slice(
      0,
      numProdutosSaida
    );

    for (const produto of produtosSaida) {
      const isKit = produto.isKit;

      // Verificar estoque disponível
      const estoque = await prisma.estoque.findFirst({
        where: {
          produtoId: produto.id,
          armazemId: armazem.id,
          quantidade: { gt: 0 },
        },
      });

      if (estoque) {
        const quantidadeDisponivel = Math.min(estoque.quantidade, 5); // No máximo 5 unidades
        const quantidadeSaida = Math.max(
          1,
          Math.floor(Math.random() * quantidadeDisponivel)
        );

        // Registrar a saída
        await prisma.detalhesSaida.create({
          data: {
            saidaId: saida.id,
            produtoId: produto.id,
            quantidade: quantidadeSaida,
            isKit: isKit,
          },
        });

        // Reduzir o estoque
        await prisma.estoque.update({
          where: {
            produtoId_armazemId: {
              produtoId: produto.id,
              armazemId: armazem.id,
            },
          },
          data: {
            quantidade: {
              decrement: quantidadeSaida,
            },
          },
        });

        // Se for um kit, também reduzir o estoque dos componentes
        if (isKit) {
          const componentes = await prisma.componente.findMany({
            where: { kitId: produto.id },
            include: { produto: true },
          });

          for (const componente of componentes) {
            const estoqueComponente = await prisma.estoque.findFirst({
              where: {
                produtoId: componente.produtoId,
                armazemId: armazem.id,
              },
            });

            if (estoqueComponente) {
              await prisma.estoque.update({
                where: {
                  produtoId_armazemId: {
                    produtoId: componente.produtoId,
                    armazemId: armazem.id,
                  },
                },
                data: {
                  quantidade: {
                    decrement: quantidadeSaida * componente.quantidade,
                  },
                },
              });
            }
          }
        }
      }
    }
  }

  // Atualizar alguns produtos para ter baixo estoque de segurança
  console.log(
    "⚠️ Configurando alguns produtos com estoque abaixo do limite de segurança..."
  );
  const produtosParaBaixoEstoque = shuffleArray([...produtos]).slice(0, 3);

  for (const produto of produtosParaBaixoEstoque) {
    const armazem = armazens[Math.floor(Math.random() * armazens.length)];

    await prisma.estoque.update({
      where: {
        produtoId_armazemId: {
          produtoId: produto.id,
          armazemId: armazem.id,
        },
      },
      data: {
        quantidade: 2,
        estoqueSeguranca: 10,
      },
    });

    console.log(
      `  ✓ Configurado estoque baixo para: ${produto.nome} no ${armazem.nome}`
    );
  }

  console.log("✅ Seed concluído com sucesso!");
}

// Função auxiliar para embaralhar um array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Executar o seed
main()
  .catch((e) => {
    console.error("❌ Erro durante o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
