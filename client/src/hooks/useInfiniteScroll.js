import { useState, useRef, useCallback } from "react";
import { getMessages } from "../services/chatService";

export function useInfiniteScroll(conversationId) {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef(null);

  const loadMore = useCallback(async (prependToMessages) => {
    if (!conversationId || !hasMore || isLoadingMore) return;

    // Snapshot scroll position before loading
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getMessages(conversationId, nextPage);
      const { messages, pagination } = res.data;

      if (messages.length === 0 || !pagination.hasMore) {
        setHasMore(false);
      } else {
        setPage(nextPage);
        setHasMore(pagination.hasMore);
      }

      // Add older messages to the top
      if (messages.length > 0) {
        prependToMessages(messages);

        // Restore scroll position so user stays at the same spot
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop += newScrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, hasMore, isLoadingMore, page]);

  // Attach to a scroll container: fires loadMore when scrolled to top
  const onScroll = useCallback((e) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop < 100 && hasMore && !isLoadingMore) {
      loadMore;
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const reset = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setIsLoadingMore(false);
  }, []);

  return { scrollContainerRef, loadMore, onScroll, hasMore, isLoadingMore, reset };
}
