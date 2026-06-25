import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="site">
      <div className="container flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} color="#7c3aed" />
          <span>
            Community Hero — hyperlocal problem solver, powered by Google Gemini
          </span>
        </div>
        <div className="muted tiny">
          Built for Vibe2Ship · Gemini 2.5 Flash · deployed on Google Cloud Run
        </div>
      </div>
    </footer>
  );
}
