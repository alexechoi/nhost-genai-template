"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
	useAuthenticationStatus,
	useUserData,
	useSignOut,
} from "@nhost/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
	Send,
	Plus,
	MessageSquare,
	Settings,
	User,
	LogOut,
	Menu,
	X,
} from "lucide-react";

interface Message {
	id: string;
	content: string;
	isUser: boolean;
	timestamp: Date;
}

interface Thread {
	id: string;
	title: string;
	lastMessage: string;
	timestamp: Date;
}

export default function ChatInterface() {
	const { isAuthenticated, isLoading } = useAuthenticationStatus();
	const user = useUserData();
	const { signOut } = useSignOut();
	const router = useRouter();
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [threads, setThreads] = useState<Thread[]>([
		{
			id: "1",
			title: "Welcome Chat",
			lastMessage: "Hello! How can I help you today?",
			timestamp: new Date(),
		},
	]);
	const [activeThreadId, setActiveThreadId] = useState("1");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	// Redirect to auth if not authenticated
	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push("/auth");
		}
	}, [isAuthenticated, isLoading, router]);

	const handleSendMessage = () => {
		if (!inputValue.trim()) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			content: inputValue,
			isUser: true,
			timestamp: new Date(),
		};

		const botMessage: Message = {
			id: (Date.now() + 1).toString(),
			content: inputValue, // Echo the same message for now
			isUser: false,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage, botMessage]);
		setInputValue("");

		// Update thread with last message
		setThreads((prev) =>
			prev.map((thread) =>
				thread.id === activeThreadId
					? { ...thread, lastMessage: inputValue, timestamp: new Date() }
					: thread,
			),
		);
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const createNewThread = () => {
		const newThread: Thread = {
			id: Date.now().toString(),
			title: "New Chat",
			lastMessage: "Start a new conversation...",
			timestamp: new Date(),
		};
		setThreads((prev) => [newThread, ...prev]);
		setActiveThreadId(newThread.id);
		setMessages([]);
		setSidebarOpen(false);
	};

	const handleSignOut = async () => {
		await signOut();
		router.push("/");
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return null; // Will be redirected by useEffect
	}

	return (
		<div className="flex h-screen bg-background">
			{/* Sidebar */}
			<div
				className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
			>
				<div className="flex flex-col h-full">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b">
						<h1 className="text-lg font-semibold">Chats</h1>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSidebarOpen(false)}
							className="lg:hidden"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>

					{/* New Chat Button */}
					<div className="p-4">
						<Button
							onClick={createNewThread}
							className="w-full justify-start"
							variant="outline"
						>
							<Plus className="mr-2 h-4 w-4" />
							New Chat
						</Button>
					</div>

					{/* Threads List */}
					<div className="flex-1 overflow-y-auto px-2">
						{threads.map((thread) => (
							<div
								key={thread.id}
								className={`mb-1 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
									activeThreadId === thread.id ? "bg-muted" : ""
								}`}
								onClick={() => {
									setActiveThreadId(thread.id);
									setSidebarOpen(false);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										setActiveThreadId(thread.id);
										setSidebarOpen(false);
									}
								}}
								tabIndex={0}
								role="button"
							>
								<div className="flex items-center gap-2">
									<MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">
											{thread.title}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>

					{/* User Profile */}
					<div className="border-t p-4">
						<div className="flex items-center gap-3 mb-3">
							<Avatar className="h-8 w-8">
								<AvatarFallback>
									<User className="h-4 w-4" />
								</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">
									{user?.displayName || user?.email?.split("@")[0] || "User"}
								</p>
								<p className="text-xs text-muted-foreground truncate">
									{user?.email}
								</p>
							</div>
						</div>
						<div className="flex gap-2">
							<Button asChild variant="outline" size="sm" className="flex-1">
								<Link href="/settings">
									<Settings className="mr-2 h-3 w-3" />
									Settings
								</Link>
							</Button>
							<Button variant="outline" size="sm" onClick={handleSignOut}>
								<LogOut className="h-3 w-3" />
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Main Chat Area */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b bg-card">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSidebarOpen(true)}
							className="lg:hidden"
						>
							<Menu className="h-4 w-4" />
						</Button>
						<h2 className="text-lg font-semibold">
							{threads.find((t) => t.id === activeThreadId)?.title || "Chat"}
						</h2>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{messages.length === 0 ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-center space-y-3">
								<MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
								<div>
									<h3 className="font-semibold">Start a conversation</h3>
									<p className="text-sm text-muted-foreground">
										Send a message to begin chatting
									</p>
								</div>
							</div>
						</div>
					) : (
						messages.map((message) => (
							<div
								key={message.id}
								className={`flex ${message.isUser ? "justify-end" : "justify-start"} mb-4`}
							>
								<div
									className={`flex items-end gap-2 max-w-[75%] sm:max-w-[60%] ${
										message.isUser ? "flex-row-reverse" : "flex-row"
									}`}
								>
									<Avatar className="h-7 w-7 flex-shrink-0">
										<AvatarFallback className="text-xs">
											{message.isUser ? (
												<User className="h-3 w-3" />
											) : (
												<MessageSquare className="h-3 w-3" />
											)}
										</AvatarFallback>
									</Avatar>
									<div
										className={`rounded-2xl px-3 py-2 ${
											message.isUser
												? "bg-primary text-primary-foreground rounded-br-md"
												: "bg-muted rounded-bl-md"
										}`}
									>
										<p className="text-sm whitespace-pre-wrap break-words">
											{message.content}
										</p>
									</div>
								</div>
							</div>
						))
					)}
					<div ref={messagesEndRef} />
				</div>

				{/* Input Area */}
				<div className="border-t p-4 bg-card">
					<div className="flex gap-3">
						<Input
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder="Type your message..."
							className="flex-1"
						/>
						<Button
							onClick={handleSendMessage}
							disabled={!inputValue.trim()}
							size="sm"
						>
							<Send className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Overlay for mobile sidebar */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
					onClick={() => setSidebarOpen(false)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setSidebarOpen(false);
						}
					}}
					role="button"
					tabIndex={0}
					aria-label="Close sidebar"
				/>
			)}
		</div>
	);
}
