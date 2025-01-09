import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { nome } = await req.json();
    if (!nome) {
      return NextResponse.json(
        { mensagem: "O nome do armazem é obrigatório" },
        { status: 500 }
      );
    }

    const armazem = await prisma.armazem.create({
      data: { nome },
    });
    return NextResponse.json(armazem, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { mensagem: "Erro ao criar Armazém" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const armazem = await prisma.armazem.findMany();
    return NextResponse.json(armazem, { status: 200 });
  } catch {
    NextResponse.json({ error: "Erro ao buscar Armazém" }, { status: 500 });
  }
}

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse
// ) {
//   if (req.method === "POST") {
//     try {
//       const { nome } = req.body;

//       if (!nome) {
//         return res.status(400).json({ error: "Nome do armazém é obrigatório" });
//       }

//       const armazem = await prisma.armazem.create({
//         data: { nome },
//       });

//       res.status(201).json(armazem);
//     } catch (error) {
//       res.status(500).json({ error: "Erro ao criar armazém" });
//     }
//   } else if (req.method === "GET") {
//     try {
//       const armazens = await prisma.armazem.findMany();
//       res.status(200).json(armazens);
//     } catch (error) {
//       res.status(500).json({ error: "Erro ao buscar armazéns" });
//     }
//   } else {
//     res.status(405).json({ message: "Método não permitido" });
//   }
// }
