import { exportTextFile, type TextFileExportOptions } from '../../utils/fileExport';
import { diagnostics } from './diagnostics';

export function buildTechnicalDiagnosticExport(): TextFileExportOptions {
  // report() constructs fresh allowlisted objects, including after persisted-data reload.
  const report = diagnostics.report();
  return { fileName: `SpendWise-technical-diagnostics-${new Date(report.generatedAt).toISOString().slice(0, 10)}.json`, content: JSON.stringify(report), mimeType: 'application/json', shareTitle: 'SpendWise technical diagnostics' };
}
export async function exportTechnicalDiagnostics(): Promise<void> { await exportTextFile(buildTechnicalDiagnosticExport()); }
