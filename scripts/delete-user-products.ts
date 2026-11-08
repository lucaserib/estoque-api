import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteUserProducts() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        name: {
          contains: 'Leap Store',
          mode: 'insensitive'
        }
      }
    })

    if (!user) {
      console.log('Usuário "Leap Store" não encontrado')
      return
    }

    console.log(`Usuário encontrado: ${user.name} (ID: ${user.id})`)

    const produtoIds = (await prisma.produto.findMany({
      where: { userId: user.id },
      select: { id: true }
    })).map(p => p.id)

    await prisma.componente.deleteMany({
      where: {
        OR: [
          { kitId: { in: produtoIds } },
          { produtoId: { in: produtoIds } }
        ]
      }
    })

    await prisma.detalhesSaida.deleteMany({
      where: { produtoId: { in: produtoIds } }
    })

    await prisma.estoque.deleteMany({
      where: { produtoId: { in: produtoIds } }
    })

    await prisma.produtoFornecedor.deleteMany({
      where: { produtoId: { in: produtoIds } }
    })

    await prisma.pedidoProduto.deleteMany({
      where: { produtoId: { in: produtoIds } }
    })

    await prisma.transferenciaItem.deleteMany({
      where: { produtoId: { in: produtoIds } }
    })

    await prisma.produtoMercadoLivre.deleteMany({
      where: { produtoId: { in: produtoIds } }
    })

    const result = await prisma.produto.deleteMany({
      where: {
        userId: user.id
      }
    })

    console.log(`✅ ${result.count} produtos deletados com sucesso!`)
  } catch (error) {
    console.error('Erro ao deletar produtos:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteUserProducts()
