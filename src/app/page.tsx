import { fallacyData } from "@/data/fallacies";
import { FallacyExplorer } from "@/components/fallacy-explorer";

export default function Home() {
  return <FallacyExplorer data={fallacyData} />;
}
