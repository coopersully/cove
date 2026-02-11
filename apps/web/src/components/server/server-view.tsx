import type { JSX } from "react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useChannels } from "../../hooks/use-channels.js";
import { ChannelView } from "../messages/channel-view.js";
import { ChannelList } from "./channel-list.js";

export function ServerView(): JSX.Element {
  const { serverId = "", channelId } = useParams();
  const navigate = useNavigate();
  const { data } = useChannels(serverId);

  // Auto-redirect to first text channel if none selected
  useEffect(() => {
    if (!channelId && data?.channels) {
      const firstTextChannel = [...data.channels]
        .filter((c) => c.type === "text")
        .sort((a, b) => a.position - b.position)[0];
      if (firstTextChannel) {
        void navigate(`/servers/${serverId}/channels/${firstTextChannel.id}`, { replace: true });
      }
    }
  }, [channelId, data, serverId, navigate]);

  const currentChannel = data?.channels.find((c) => c.id === channelId);

  return (
    <>
      <ChannelList serverId={serverId} />
      {channelId ? (
        <ChannelView key={channelId} channelId={channelId} channelName={currentChannel?.name} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <p className="font-body text-sm">Select a channel to start chatting</p>
        </div>
      )}
    </>
  );
}
