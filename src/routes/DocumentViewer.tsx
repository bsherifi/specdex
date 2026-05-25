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
        onCapture={(capture) => {
          // Plan 27 owns the entry editor. Until then, route to a placeholder
          // /kbs page with the capture serialized as URL params; the entry
          // editor will read them.
          const cap = encodeURIComponent(JSON.stringify({ ...capture, source_doc_id: id }));
          navigate(`/kbs?new_entry_capture=${cap}`);
        }}
      />
      {params.get("page") && (
        <div className="hidden">deep-link to page {params.get("page")}</div>
      )}
    </div>
  );
}
