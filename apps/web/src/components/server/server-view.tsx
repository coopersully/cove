import type { JSX } from "react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useChannels } from "../../hooks/use-channels.js";
import { useDocumentTitle } from "../../hooks/use-document-title.js";
import { useServer } from "../../hooks/use-servers.js";
import { ChannelView } from "../messages/channel-view.js";
import { ChannelList } from "./channel-list.js";

export function ServerView(): JSX.Element {
  const { serverId = "", channelId } = useParams();
  const navigate = useNavigate();
  const { data: serverData } = useServer(serverId);
  const { data: channelData } = useChannels(serverId);

  const server = serverData?.server;
  const currentChannel = channelData?.channels.find((c) => c.id === channelId);

  const titleParts = [currentChannel ? `#${currentChannel.name}` : undefined, server?.name].filter(
    Boolean,
  );
  useDocumentTitle(titleParts.length > 0 ? titleParts.join(" | ") : undefined);

  // Auto-redirect to first text channel if none selected
  useEffect(() => {
    if (!channelId && channelData?.channels) {
      const firstTextChannel = [...channelData.channels]
        .filter((c) => c.type === "text")
        .sort((a, b) => a.position - b.position)[0];
      if (firstTextChannel) {
        void navigate(`/servers/${serverId}/channels/${firstTextChannel.id}`, { replace: true });
      }
    }
  }, [channelId, channelData, serverId, navigate]);

  return (
    <>
      <ChannelList serverId={serverId} />
      {channelId ? (
        <ChannelView key={channelId} channelId={channelId} channelName={currentChannel?.name} />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground">
          <p className="font-body text-sm">Select a channel to start chatting</p>
        </div>
      )}
    </>
  );
}
