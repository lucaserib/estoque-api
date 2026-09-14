import { CubeMark } from "@/components/brand/Logo";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen w-full flex-wrap bg-background">
      <div className="dark flex min-w-0 flex-1 basis-[400px] flex-col justify-between gap-14 bg-background px-8 py-14 text-foreground sm:px-12">
        <div className="flex items-center gap-3">
          <CubeMark className="h-7 w-7" />
          <span className="text-base font-semibold tracking-[0.01em]">Leap Stock</span>
        </div>
        <div className="max-w-[46ch]">
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.1em] text-primary">
            Controle de estoque multicanal
          </p>
          <h1 className="text-balance text-[42px] font-semibold leading-[1.15] tracking-tight">
            Um estoque só, todos os canais em ordem.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            Mercado Livre e Bling sincronizados com o estoque local, custo
            médio calculado por entrada e reposição projetada sobre a venda
            real.
          </p>
          <div className="mt-9 flex flex-wrap gap-8">
            <div>
              <p className="font-mono text-2xl font-semibold text-foreground">1.284</p>
              <p className="mt-2 text-[13px] text-faint">SKUs ativos</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold text-foreground">412</p>
              <p className="mt-2 text-[13px] text-faint">Anúncios sincronizados</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold text-foreground">99,4%</p>
              <p className="mt-2 text-[13px] text-faint">Acurácia de estoque</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-faint">
          © {new Date().getFullYear()} Leap Stock · Todos os direitos reservados
        </p>
      </div>

      <div className="flex min-w-0 flex-1 basis-[400px] items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[392px] rounded-lg border border-border bg-card p-8 shadow-lift">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
