# Conferência de Saídas por Código de Barras

A funcionalidade de conferência de saídas por código de barras permite verificar se os produtos que estão sendo entregues/retirados correspondem exatamente ao que foi registrado no sistema.

## Como funciona

1. Na listagem de saídas, cada registro possui dois botões:

   - 👁️ (Detalhes) - Para visualizar os detalhes da saída
   - 📷 (Código de barras) - Para iniciar a conferência por código de barras

2. Ao clicar no botão de código de barras, o sistema abre a saída no modo de conferência, onde:

   - Todas as quantidades são zeradas inicialmente
   - Cada produto lido com o scanner incrementa sua quantidade
   - Produtos com quantidades diferentes das originais são destacados visualmente
   - Um contador mostra o progresso da conferência (itens contados vs. esperados)

3. A conferência é considerada "completa" quando todos os produtos tiverem quantidades iguais às registradas originalmente.

## Recursos da conferência por código de barras

- **Inicialização automática**: Quantidades começam em zero
- **Incremento por leitura**: Cada leitura de código de barras incrementa o produto em 1 unidade
- **Feedback visual**:
  - 🟡 Amarelo: Indica produtos com quantidade inferior à esperada
  - 🔴 Vermelho: Indica produtos com quantidade superior à esperada
  - 🟢 Verde: Indica produtos com quantidade igual à esperada
- **Histórico de leituras**: Mantém um registro de todas as leituras feitas
- **Produtos desconhecidos**: Registra códigos de barras que não correspondem a nenhum produto da saída
- **Botão de reinício**: Permite zerar todas as contagens e recomeçar
- **Entrada manual**: Além do scanner, é possível ajustar as quantidades manualmente

## Fluxo de trabalho recomendado

1. Abra a saída no modo de conferência por código de barras
2. Escaneie os produtos um a um à medida que são preparados
3. Verifique se todas as quantidades correspondem às esperadas
4. Se houver discrepâncias, investigue as razões
5. Caso necessário, ajuste as quantidades manualmente ou reinicie a conferência

## Dicas

- Certifique-se de que todos os produtos tenham códigos EAN cadastrados para usar esta funcionalidade
- É possível alternar entre o modo de conferência e o modo de visualização normal a qualquer momento
- Para conferências mais rápidas, use um scanner de código de barras externo
- Para uma conferência parcial, não é necessário escanear todos os produtos - apenas os que desejar verificar

# Módulo de Saídas - Documentação

## Funcionalidade de Leitura de Código de Barras

O módulo de saídas permite a adição de produtos por meio de leitura de código de barras durante a criação de uma nova saída. Esta funcionalidade foi projetada para tornar o processo de registro de saídas mais rápido e preciso, especialmente quando os produtos físicos estão disponíveis para escaneamento.

### Como Funciona

1. Ao criar uma nova saída, selecione primeiro o armazém de origem
2. Clique no botão "Ler Código de Barras" para ativar o modo de leitura
3. Escaneie os códigos de barras dos produtos utilizando a câmera do dispositivo
4. Os produtos serão automaticamente adicionados à lista de saída
5. Escaneie o mesmo produto múltiplas vezes para aumentar sua quantidade
6. Finalize a saída normalmente após adicionar todos os produtos

### Formas de Adicionar Produtos

O sistema oferece várias maneiras de adicionar produtos à saída:

1. **Escaneamento de Código de Barras**: Use a câmera para escanear o código de barras do produto.
2. **Entrada Manual de Código**: Digite o código de barras ou SKU diretamente no campo de leitura.
3. **Busca Direta por Produto**: Use o campo de busca direta para encontrar o produto por nome ou SKU.

Você pode escolher o método mais conveniente para seu fluxo de trabalho.

### Recursos Principais

- **Alternância entre Modos**: Alterne facilmente entre o modo manual de seleção de produtos e o modo de leitura de código de barras
- **Escaneamento Contínuo**: Escaneie múltiplos produtos em sequência sem precisar reiniciar o scanner
- **Histórico de Leituras**: Visualize todas as leituras realizadas durante a sessão
- **Alertas de Produtos Desconhecidos**: Receba alertas quando um código de barras não corresponder a nenhum produto cadastrado
- **Entrada Manual**: Digite manualmente códigos de barras caso a leitura automática não seja possível
- **Busca Direta**: Encontre produtos por SKU ou nome para adicioná-los rapidamente

### Dicas de Uso

- Mantenha boa iluminação para melhorar a precisão da leitura
- Posicione o código de barras centralizado na área de captura da câmera
- Para produtos em grande quantidade, utilize o campo de quantidade na busca direta
- Se um código de barras não for reconhecido, tente usar o SKU do produto
- Verifique a lista de produtos adicionados regularmente para garantir que todos os itens foram corretamente reconhecidos
- Para produtos sem código de barras físico, use a busca direta por nome ou SKU

### Compatibilidade

- A leitura de código de barras funciona em dispositivos com câmera (computadores, tablets e smartphones)
- Suporta códigos no formato EAN-13, EAN-8, Code 128, QR Code e outros formatos comuns
- Navegadores compatíveis: Chrome, Edge, Safari (versões recentes)
- Se a câmera não funcionar, você sempre pode recorrer à entrada manual ou busca direta

### Solução de Problemas

Se encontrar dificuldades com a leitura de código de barras:

1. Verifique se a câmera tem permissão para ser usada no navegador
2. Certifique-se de que há iluminação adequada
3. Tente ajustar a distância entre o código de barras e a câmera
4. Confirme se o código de barras está cadastrado no sistema
5. Use o SKU do produto como alternativa ao código de barras
6. Utilize a busca direta por nome do produto quando os códigos não forem reconhecidos

### Códigos de Barras Específicos

#### EAN 7895502400037

Se estiver tendo problemas para escanear o código EAN `7895502400037`:

1. **Verifique o cadastro do produto**:

   - Confirme se esse EAN está corretamente cadastrado no sistema
   - Certifique-se de que o produto está disponível no armazém selecionado
   - Verifique se o EAN está registrado em algum dos campos possíveis: `ean`, `codigoEAN`, `codigoBarras` ou como código alternativo

2. **Busca alternativa**:

   - Busque o produto diretamente pelo código SKU
   - Use a busca direta por nome do produto
   - Tente digitar o código manualmente no campo de leitura

3. **Resolução de conflitos**:
   - Em casos raros, pode haver conflitos entre códigos de produtos diferentes
   - Confirme no cadastro de produtos se há duplicidade de códigos
   - Verifique se o mesmo código está sendo usado tanto no SKU quanto no EAN

O sistema agora inclui melhorias específicas para identificar este código. Logs adicionais são gerados no console do navegador quando este código é escaneado, o que pode ajudar na resolução de problemas.

### Verificação da Estrutura de Dados

Para problemas persistentes de leitura de códigos, é importante entender como os dados dos produtos estão estruturados no sistema:

1. **Campos de código possíveis**:

   - `sku`: Código interno do produto (sempre presente)
   - `ean`: Código EAN principal
   - `codigoEAN`: Campo alternativo para código EAN
   - `codigoBarras`: Campo alternativo para código de barras
   - `codigosBarrasAlternativos`: Array de códigos alternativos

2. **Verificação de cadastro**:

   - Ao cadastrar produtos, certifique-se de que o código de barras está no campo correto
   - Produtos importados podem ter os códigos em campos diferentes
   - O sistema tenta buscar em todos os campos possíveis, mas é recomendável manter consistência

3. **Diagnóstico avançado**:
   - O sistema registra detalhes de diagnóstico no console do navegador quando há falhas na leitura
   - Estes logs podem ser úteis para o suporte técnico na identificação de problemas
   - Para ativar logs detalhados, escaneie o código com problemas várias vezes consecutivas
