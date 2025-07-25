"use client";

import { useState, useEffect } from "react";
import { useUserData } from "@nhost/nextjs";
import { nhost } from "../../lib/nhost";

export interface Message {
	id: string;
	thread_id: string;
	user_id: string;
	is_user: boolean;
	content: string;
	created_at: string;
}

export interface Thread {
	id: string;
	user_id: string;
	title: string;
	created_at: string;
	updated_at: string;
}

// GraphQL queries and mutations
const GET_THREADS = `
  query GetThreads($user_id: uuid!) {
    threads(where: {user_id: {_eq: $user_id}}, order_by: {updated_at: desc}) {
      id
      user_id
      title
      created_at
      updated_at
    }
  }
`;

const GET_MESSAGES = `
  query GetMessages($thread_id: uuid!) {
    messages(where: {thread_id: {_eq: $thread_id}}, order_by: {created_at: asc}) {
      id
      thread_id
      user_id
      is_user
      content
      created_at
    }
  }
`;

const CREATE_THREAD = `
  mutation CreateThread($user_id: uuid!, $title: String!) {
    insert_threads_one(object: {user_id: $user_id, title: $title}) {
      id
      user_id
      title
      created_at
      updated_at
    }
  }
`;

const CREATE_MESSAGE = `
  mutation CreateMessage($thread_id: uuid!, $user_id: uuid!, $is_user: Boolean!, $content: String!) {
    insert_messages_one(object: {thread_id: $thread_id, user_id: $user_id, is_user: $is_user, content: $content}) {
      id
      thread_id
      user_id
      is_user
      content
      created_at
    }
  }
`;

const UPDATE_THREAD_TIMESTAMP = `
  mutation UpdateThreadTimestamp($thread_id: uuid!) {
    update_threads_by_pk(pk_columns: {id: $thread_id}, _set: {updated_at: "now()"}) {
      id
      updated_at
    }
  }
`;

interface ChatManagerProps {
	children: (props: {
		threads: Thread[];
		messages: Message[];
		activeThreadId: string | null;
		isLoading: boolean;
		error: string | null;
		createThread: () => Promise<string | null>;
		selectThread: (threadId: string) => Promise<void>;
		sendMessage: (content: string) => Promise<void>;
	}) => React.ReactNode;
}

export default function ChatManager({ children }: ChatManagerProps) {
	const user = useUserData();
	const [threads, setThreads] = useState<Thread[]>([]);
	const [messages, setMessages] = useState<Message[]>([]);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch threads when user is available
	useEffect(() => {
		async function fetchThreads() {
			if (!user?.id) return;

			try {
				setIsLoading(true);
				setError(null);
				const { data, error } = await nhost.graphql.request(GET_THREADS, {
					user_id: user.id,
				});

				if (error) {
					console.error("GraphQL Error:", error);
					setError(
						"Failed to fetch threads. Make sure GraphQL permissions are set up correctly.",
					);
				} else {
					const fetchedThreads = data?.threads || [];
					setThreads(fetchedThreads);

					// If no active thread and we have threads, select the first one
					if (!activeThreadId && fetchedThreads.length > 0) {
						setActiveThreadId(fetchedThreads[0].id);
					}
				}
			} catch (err) {
				console.error("Fetch Error:", err);
				setError("Failed to connect to the database.");
			} finally {
				setIsLoading(false);
			}
		}

		if (user?.id) {
			fetchThreads();
		}
	}, [user?.id, activeThreadId]);

	// Fetch messages when active thread changes
	useEffect(() => {
		async function fetchMessages() {
			if (!activeThreadId) {
				setMessages([]);
				return;
			}

			try {
				const { data, error } = await nhost.graphql.request(GET_MESSAGES, {
					thread_id: activeThreadId,
				});

				if (error) {
					console.error("GraphQL Error:", error);
					setError("Failed to fetch messages.");
				} else {
					setMessages(data?.messages || []);
				}
			} catch (err) {
				console.error("Fetch Error:", err);
				setError("Failed to fetch messages.");
			}
		}

		fetchMessages();
	}, [activeThreadId]);

	const createThread = async (): Promise<string | null> => {
		if (!user?.id) return null;

		try {
			// Create title with current timestamp
			const now = new Date();
			const title = now.toLocaleString("en-US", {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});

			const { data, error } = await nhost.graphql.request(CREATE_THREAD, {
				user_id: user.id,
				title: title,
			});

			if (error) {
				console.error("GraphQL Error:", error);
				setError("Failed to create thread.");
				return null;
			}

			const newThread = data?.insert_threads_one;
			if (newThread) {
				setThreads((prev) => [newThread, ...prev]);
				setActiveThreadId(newThread.id);
				setMessages([]); // Clear messages for new thread
				return newThread.id;
			}
		} catch (err) {
			console.error("Create Thread Error:", err);
			setError("Failed to create thread.");
		}

		return null;
	};

	const selectThread = async (threadId: string): Promise<void> => {
		setActiveThreadId(threadId);
	};

	const sendMessage = async (content: string): Promise<void> => {
		if (!user?.id || !activeThreadId || !content.trim()) return;

		try {
			// Create user message
			const { data: userMessageData, error: userMessageError } =
				await nhost.graphql.request(CREATE_MESSAGE, {
					thread_id: activeThreadId,
					user_id: user.id,
					is_user: true,
					content: content.trim(),
				});

			if (userMessageError) {
				console.error("GraphQL Error:", userMessageError);
				setError("Failed to send message.");
				return;
			}

			// Create bot message (echo for now)
			const { data: botMessageData, error: botMessageError } =
				await nhost.graphql.request(CREATE_MESSAGE, {
					thread_id: activeThreadId,
					user_id: user.id,
					is_user: false,
					content: content.trim(), // Echo the same message
				});

			if (botMessageError) {
				console.error("GraphQL Error:", botMessageError);
				setError("Failed to create bot response.");
				return;
			}

			// Update thread timestamp
			await nhost.graphql.request(UPDATE_THREAD_TIMESTAMP, {
				thread_id: activeThreadId,
			});

			// Add both messages to state
			const userMessage = userMessageData?.insert_messages_one;
			const botMessage = botMessageData?.insert_messages_one;

			if (userMessage && botMessage) {
				setMessages((prev) => [...prev, userMessage, botMessage]);

				// Update thread's updated_at in local state
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === activeThreadId
							? { ...thread, updated_at: new Date().toISOString() }
							: thread,
					),
				);
			}
		} catch (err) {
			console.error("Send Message Error:", err);
			setError("Failed to send message.");
		}
	};

	return (
		<>
			{children({
				threads,
				messages,
				activeThreadId,
				isLoading,
				error,
				createThread,
				selectThread,
				sendMessage,
			})}
		</>
	);
}
