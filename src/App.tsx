import { useWizard } from "./lib/wizard";
import { UploadStep } from "./steps/UploadStep";
import { EditStep } from "./steps/EditStep";
import { TraceStep } from "./steps/TraceStep";
import { ExportStep } from "./steps/ExportStep";

export function App() {
  const wizard = useWizard();

  return (
    <main>
      <h1>image-converter</h1>
      {wizard.step === "upload" && <UploadStep wizard={wizard} />}
      {wizard.step === "edit" && <EditStep wizard={wizard} />}
      {wizard.step === "trace" && <TraceStep wizard={wizard} />}
      {wizard.step === "export" && <ExportStep wizard={wizard} />}
    </main>
  );
}
