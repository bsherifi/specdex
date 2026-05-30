import type { JSX } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PdfViewer } from "@/components/PdfViewer";

export default function DocumentViewer(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  if (!id) return <div>Missing document id.</div>;
  return (
    <div className="-m-6 h-screen">
      <PdfViewer
        sourceDocId={id}
        onOpenEntry={(entryId, kbId) => {
          // Clicking an auto-highlight opens that existing entry for editing.
          navigate(`/kbs/${kbId}`, { state: { openEntryId: entryId } });
        }}
      />
      {params.get("page") && (
        <div className="hidden">deep-link to page {params.get("page")}</div>
      )}
    </div>
  );
}
