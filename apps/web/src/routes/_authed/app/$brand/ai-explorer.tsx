/**
 * /app/$brand/ai-explorer - AI Mentions Explorer list + create page, scoped to
 * the current brand. Access is gated by the parent `$brand` layout (any user
 * who can view the brand can generate/view reports for it).
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getAppName } from "@/lib/route-head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { ExternalLink } from "lucide-react";
import { getExplorerReportsFn, createExplorerReportFn } from "@/server/explorer-reports";

export const Route = createFileRoute("/_authed/app/$brand/ai-explorer")({
	head: ({ match }) => {
		const appName = getAppName(match);
		return {
			meta: [
				{ title: `AI Mentions Explorer · ${appName}` },
				{ name: "description", content: "Generate and view AI mentions explorer reports." },
			],
		};
	},
	component: AiExplorerPage,
});

function AiExplorerPage() {
	const { brand: brandId } = Route.useParams();
	const queryClient = useQueryClient();

	const { data: reports = [] } = useQuery({
		queryKey: ["explorer-reports", brandId],
		queryFn: () => getExplorerReportsFn({ data: { brandId } }),
		refetchInterval: 5000,
		staleTime: 2000,
	});

	const [windowDays, setWindowDays] = useState("30");
	const [language, setLanguage] = useState<"en" | "vi">("vi");
	const [error, setError] = useState("");

	const createMutation = useMutation({
		mutationFn: () =>
			createExplorerReportFn({ data: { brandId, windowDays: Number(windowDays), language } }),
		onSuccess: () => {
			setError("");
			queryClient.invalidateQueries({ queryKey: ["explorer-reports", brandId] });
		},
		onError: (err: Error) => {
			setError(err.message || "An error occurred");
		},
	});

	return (
		<div className="space-y-8">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">AI Mentions Explorer</h1>
				<p className="text-muted-foreground">Pick a window and language to generate a report.</p>
			</div>
			<div className="space-y-6 max-w-4xl">
				<div className="space-y-4">
					<h2 className="text-2xl font-semibold">Generate New Report</h2>

					<Card>
						<CardContent className="space-y-4 pt-6">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-1.5">
									<Label>Window</Label>
									<Select value={windowDays} onValueChange={setWindowDays}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="30">30 days</SelectItem>
											<SelectItem value="90">90 days</SelectItem>
											<SelectItem value="180">180 days</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label>Language</Label>
									<Select value={language} onValueChange={(v) => setLanguage(v as "en" | "vi")}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="vi">Tiếng Việt</SelectItem>
											<SelectItem value="en">English</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							{error && <p className="text-sm text-destructive">{error}</p>}

							<Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()} className="cursor-pointer">
								{createMutation.isPending ? "Generating…" : "Generate report"}
							</Button>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-4">
					<h2 className="text-2xl font-semibold">Report History</h2>

					{reports.length === 0 ? (
						<Card>
							<CardContent className="py-8 text-center">
								<p className="text-muted-foreground">No reports found.</p>
							</CardContent>
						</Card>
					) : (
						<div className="space-y-3">
							{reports.map((r) => (
								<div
									key={r.id}
									className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between"
								>
									<div className="text-sm">
										<span className="font-semibold text-lg">{r.brandName}</span>
										<span className="text-muted-foreground">
											{" "}
											· {r.windowDays}d · {r.language} · {r.model ?? "—"}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant={r.status === "completed" ? "default" : "secondary"}>
											{r.status === "processing" ? `${r.progress}%` : r.status}
										</Badge>
										{r.status === "completed" && (
											<a href={`/api/explorer/${r.id}`} target="_blank" rel="noreferrer">
												<Button variant="default" size="sm" className="cursor-pointer h-6 px-2 text-xs">
													<ExternalLink className="size-3 mr-0.5" />
													View
												</Button>
											</a>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
