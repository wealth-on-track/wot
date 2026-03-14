import DeployClient from './DeployClient';

export default function DeployPage() {
  return (
    <main style={{ padding: '20px 20px 20px 32px', display: 'grid', gap: 16, background: '#f3f7fb', minHeight: '100vh' }}>
      <DeployClient />
    </main>
  );
}
