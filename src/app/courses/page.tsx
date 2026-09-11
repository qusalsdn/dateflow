import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SavedCourseList, type SavedCourse } from "@/components/course/saved-course-list";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="app-shell saved-courses"><p className="eyebrow">내 코스 <span /> 로그인 필요</p><h1>저장한 코스를 보려면 로그인해 주세요.</h1><p className="intro">코스를 저장할 때 카카오 로그인을 시작할 수 있어요.</p><Link className="secondary-button" href="/">코스 만들기</Link></main>;
  const { data } = await supabase.from("courses").select("id, title, public_id, is_shared, created_at, course_data").order("created_at", { ascending: false });
  const courses = (data ?? []) as unknown as SavedCourse[];
  return <main className="app-shell saved-courses"><p className="eyebrow">내 코스 <span /> {user.email ?? "카카오 계정"}</p><h1>저장한 동선</h1><SavedCourseList initialCourses={courses} /><Link className="back-link" href="/">새 코스 만들기</Link></main>;
}
