"use client";

import Link from "next/link";
import { useState } from "react";
import type { GeneratedCourse } from "@/lib/course/types";

export type SavedCourse = { id: string; title: string; public_id: string; is_shared: boolean; created_at: string; course_data: GeneratedCourse };

export function SavedCourseList({ initialCourses }: { initialCourses: SavedCourse[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggleVisibility(course: SavedCourse) {
    setWorkingId(course.id); setError("");
    try {
      const response = await fetch(`/api/courses/${course.public_id}/share`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isShared: !course.is_shared }) });
      if (!response.ok) throw new Error((await response.json() as { error?: { message?: string } }).error?.message ?? "공개 상태를 바꾸지 못했어요.");
      setCourses((current) => current.map((item) => item.id === course.id ? { ...item, is_shared: !item.is_shared } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "공개 상태를 바꾸지 못했어요."); }
    finally { setWorkingId(null); }
  }

  async function remove(course: SavedCourse) {
    if (!window.confirm(`“${course.title}” 코스를 삭제할까요? 이 작업은 되돌릴 수 없어요.`)) return;
    setWorkingId(course.id); setError("");
    try {
      const response = await fetch(`/api/courses/${course.public_id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json() as { error?: { message?: string } }).error?.message ?? "코스를 삭제하지 못했어요.");
      setCourses((current) => current.filter((item) => item.id !== course.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "코스를 삭제하지 못했어요."); }
    finally { setWorkingId(null); }
  }

  if (!courses.length) return <div className="empty-results"><h2>저장한 코스가 없어요.</h2><p>장소를 고르고 코스를 만든 뒤, 필요할 때 다시 꺼내 볼 수 있어요.</p><Link className="secondary-button" href="/">코스 만들기</Link></div>;
  return <><ul className="saved-course-list">{courses.map((course) => <li key={course.id} className="saved-course-card"><div className="saved-course-card-header"><span className={`course-visibility-status${course.is_shared ? " is-shared" : ""}`}>{course.is_shared ? "공개됨" : "비공개"}</span><time>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(course.created_at))}</time></div><div className="saved-course-card-body"><strong>{course.title}</strong><p>{course.course_data.date} · 방문 {course.course_data.stops.filter((stop) => stop.kind === "place").length}곳 · 이동 약 {course.course_data.totalTravelMinutes}분</p></div><div className="saved-course-actions">{course.is_shared && <Link className="secondary-button compact-button" href={`/share/${course.public_id}`}>공유 페이지</Link>}<button className="text-button" type="button" disabled={workingId === course.id} onClick={() => void toggleVisibility(course)}>{course.is_shared ? "비공개로 전환" : "공개하기"}</button><button className="danger-button" type="button" disabled={workingId === course.id} onClick={() => void remove(course)}>삭제</button></div></li>)}</ul>{error && <div className="form-error course-error" role="alert"><strong>저장한 코스를 변경하지 못했어요</strong><p>{error}</p></div>}</>;
}
