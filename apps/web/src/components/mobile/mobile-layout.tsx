import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useChannels } from "../../hooks/use-channels.js";
import { useDocumentTitle } from "../../hooks/use-document-title.js";
import { useServer } from "../../hooks/use-servers.js";
import { Logo } from "../logo.js";
import { MessageComposer } from "../messages/message-composer.js";
import { MessageFeed } from "../messages/message-feed.js";
import { MobileChannelPicker } from "./mobile-channel-picker.js";
import { MobileServerPicker } from "./mobile-server-picker.js";
import { MobileTopBar } from "./mobile-top-bar.js";

export function MobileLayout(): JSX.Element {
  const { serverId = "", channelId } = useParams();
  const navigate = useNavigate();
  const { data: serverData } = useServer(serverId);
  const { data: channelData } = useChannels(serverId);

  const [serverPickerOpen, setServerPickerOpen] = useState(false);
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);

  const server = serverData?.server;
  const currentChannel = channelData?.channels.find((c) => c.id === channelId);

  const titleParts = [currentChannel ? `#${currentChannel.name}` : undefined, server?.name].filter(
    Boolean,
  );
  useDocumentTitle(titleParts.length > 0 ? titleParts.join(" | ") : undefined);

  // Auto-redirect to first text channel (mirrors ServerView logic)
  useEffect(() => {
    if (serverId && !channelId && channelData?.channels) {
      const firstTextChannel = [...channelData.channels]
        .filter((c) => c.type === "text")
        .sort((a, b) => a.position - b.position)[0];
      if (firstTextChannel) {
        void navigate(`/servers/${serverId}/channels/${firstTextChannel.id}`, { replace: true });
      }
    }
  }, [channelId, channelData, serverId, navigate]);

  return (
    <div
      className="relative flex h-dvh flex-col bg-background text-foreground"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top edge blur */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32"
        style={{
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          maskImage: "linear-gradient(to bottom, black 35%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 35%, transparent)",
        }}
      />

      {/* Bottom edge blur */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32"
        style={{
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          maskImage: "linear-gradient(to top, black 35%, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black 35%, transparent)",
        }}
      />

      {/* Top pill */}
      <div className="relative z-20 shrink-0 px-3 pt-2">
        <MobileTopBar
          server={server}
          channelName={currentChannel?.name}
          onOpenServerPicker={() => setServerPickerOpen(true)}
          onOpenChannelPicker={() => setChannelPickerOpen(true)}
        />
      </div>

      {/* Main content area */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Warm gradient */}
        <div
          className="pointer-events-none absolute right-0 bottom-0 left-0 h-32"
          style={{
            background: "linear-gradient(to top, rgba(28,25,23,0.02) 0%, transparent 100%)",
          }}
        />

        {channelId ? (
          <MessageFeed channelId={channelId} />
        ) : serverId ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <p className="font-body text-sm">Select a channel to start chatting</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Logo className="size-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="font-display font-semibold text-foreground text-xl">
                Welcome to Cove
              </h2>
              <p className="mt-2 max-w-xs font-body text-sm">
                Select a server or create a new one to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom pill */}
      {channelId && (
        <div className="relative z-20 shrink-0 px-3 pb-2">
          <div className="[&>div>div]:rounded-2xl [&>div>div]:shadow-sm [&>div>div]:ring-1 [&>div>div]:ring-border/40 [&>div]:border-0 [&>div]:p-0">
            <MessageComposer channelId={channelId} />
          </div>
        </div>
      )}

      {/* Drawers (portalled) */}
      <MobileServerPicker open={serverPickerOpen} onOpenChange={setServerPickerOpen} />
      {serverId && (
        <MobileChannelPicker
          open={channelPickerOpen}
          onOpenChange={setChannelPickerOpen}
          serverId={serverId}
        />
      )}
    </div>
  );
}
