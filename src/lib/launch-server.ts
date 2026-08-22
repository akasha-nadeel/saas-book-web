export function launchFeatureEnabled(): boolean {
  return process.env.OPENCHAPTER_LAUNCH_MVP === "0";
}

export function hiddenLaunchApiResponse(feature: string): Response {
  return Response.json(
    {
      error: `${feature} is hidden for the launch MVP.`,
    },
    { status: 404 },
  );
}
