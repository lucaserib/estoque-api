import { Logo } from "@/components/brand/Logo";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen w-full flex-wrap bg-background">
      <div className="flex min-w-0 flex-1 basis-[400px] flex-col justify-between gap-14 bg-primary px-8 py-14 text-white sm:px-12">
        <Logo size="md" onBrand className="text-white" />
        <div className="max-w-[46ch]">
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.1em] text-white/80">
            Controle de estoque multicanal
          </p>
          <h1 className="text-balance text-[42px] font-semibold leading-[1.15] tracking-tight">
            O estoque e o lucro da sua loja, num cubo só.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/80">
            Mercado Livre e Bling sincronizados com o estoque local, custo
            médio calculado por entrada e reposição projetada sobre a venda
            real.
          </p>
          <div className="mt-9 flex flex-wrap gap-8">
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-[-0.01em]">1.284</p>
              <p className="mt-2 text-[13px] text-white/70">SKUs ativos</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-[-0.01em]">412</p>
              <p className="mt-2 text-[13px] text-white/70">Anúncios sincronizados</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-[-0.01em]">99,4%</p>
              <p className="mt-2 text-[13px] text-white/70">Acurácia de estoque</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-white/70">
          © {new Date().getFullYear()} Skubo · Todos os direitos reservados
        </p>
      </div>

      <div className="flex min-w-0 flex-1 basis-[400px] items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[392px] rounded-card border border-border bg-card p-8 shadow-lift">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
