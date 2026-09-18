// Direct port of lib/WebView/Hompage/main_content_tabs.dart — three
// equal-width columns shown SIMULTANEOUSLY (there is no tab-switching
// state in the original; it's a Row of 3 Expanded widgets).
//
// Separators removed: no right-hand border between columns and no
// hairline divider under the label headers. Columns now sit flush,
// separated only by their own internal padding.

export function MainContentColumns({
  arena,
  feed,
  logs,
}: {
  arena: React.ReactNode;
  feed: React.ReactNode;
  logs: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <ColumnShell label="Arena">{arena}</ColumnShell>
      <ColumnShell label="Feed">{feed}</ColumnShell>
      <ColumnShell label="Logs">{logs}</ColumnShell>
    </div>
  );
}

function ColumnShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="px-fan-lg pb-fan-md pt-fan-base">
        <span className="text-[11px] font-semibold tracking-[0.5px] text-fan-textSecondary">
          {label.toUpperCase()}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}