// Calculator Page — quick arithmetic with keyboard support

import { PageContainer, ContentWrapper } from '../components/layout/AppLayout';
import { Calculator } from '../features/calculator/Calculator';

export function CalculatorPage() {
  return (
    <PageContainer>
      <ContentWrapper className="max-w-xl">
        <header className="page-header">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">Calculator</h1>
            <p className="text-ink-muted">Quick arithmetic — addition, subtraction, multiplication and division</p>
          </div>
        </header>

        <Calculator />
      </ContentWrapper>
    </PageContainer>
  );
}
