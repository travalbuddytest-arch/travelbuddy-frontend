export function initCommand() {
  // lightweight initializer for command center fragment
  const kpis = document.getElementById('kpis');
  const activity = document.getElementById('activity');
  const risks = document.getElementById('risks');
  if (kpis) kpis.textContent = '';
  if (activity) activity.textContent = '';
  if (risks) risks.textContent = '';
}

// Auto-run when module is loaded
try { initCommand(); } catch (e) { console.warn('command init failed', e); }
