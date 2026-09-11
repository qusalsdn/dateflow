import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedCourse } from "@/lib/course/types";

export const dynamic = "force-dynamic";

type SharedCourse = { title: string; course_data: GeneratedCourse };

export default async function SharedCoursePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_course", { requested_public_id: publicId }).maybeSingle();
  if (error || !data) notFound();
  const shared = data as unknown as SharedCourse;
  const course = shared.course_data;
  return <main className="shared-course app-shell"><p className="eyebrow">DATEFLOW <span /> 공유된 코스</p><h1>{shared.title}</h1><p className="intro">{course.date} · 이동 약 {course.totalTravelMinutes}분 · 두 사람 기준 {course.estimatedTotalCost === null ? "비용 확인 필요" : `예상 ${new Intl.NumberFormat("ko-KR").format(course.estimatedTotalCost)}원`}</p><ol className="shared-timeline">{course.stops.map((stop, index) => <li key={`${stop.id}-${index}`}><time>{stop.startTime}–{stop.endTime}</time><div><strong>{stop.name}</strong><p>{stop.kind === "fixed_schedule" ? "고정 일정" : stop.address}</p></div></li>)}</ol><p className="source-note">장소 정보는 저장 당시의 스냅샷입니다. 영업 시간·가격·이동 경로는 방문 전 다시 확인해 주세요.</p></main>;
}
