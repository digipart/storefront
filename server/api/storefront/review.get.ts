// The rating subjects the shop asks for on a product review (Digipart: api/review/subjects, the API every front uses): « Qualité » as stars, « Taille » as a scale between two or three labels.
export default defineEventHandler(async (event) => {
  const { lang } = langOf(event)
  const answer = await shopApi<any>(event, 'review/subjects', { ReviewType: 'product', LanguageIsoCode: lang.toUpperCase() })
  const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max)
  return {
    Subjects: (Array.isArray(answer?.Subjects) ? answer.Subjects : []).slice(0, 12).map((s: any) => ({
      Id: Number(s.IdReviewSubject) || 0, Name: text(s.ReviewSubjectName, 80), Scale: s.SubjectType === 'scale', Mandatory: Number(s.IsMandatory) === 1,
      Min: text(s.ScaleLabelMin, 60), Mid: text(s.ScaleLabelMid, 60), Max: text(s.ScaleLabelMax, 60),
    })).filter((s: any) => s.Id > 0 && s.Name),
  }
})
