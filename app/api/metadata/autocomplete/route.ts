import { createClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const field = searchParams.get('field')
    const query = searchParams.get('query') || ''

    if (
      !field ||
      !['university', 'subject', 'course_name', 'course_code'].includes(field)
    ) {
      return NextResponse.json(
        { error: 'Invalid field parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    let data: any[] = []

    if (field === 'university') {
      // Get distinct universities from summaries where is_public = true
      const { data: universities, error } = await supabase
        .from('summaries')
        .select('university')
        .not('university', 'is', null)
        .ilike('university', `%${query}%`)
        .eq('is_public', true)
        .limit(10)

      if (error) throw error

      // Get unique values
      const uniqueUniversities = [
        ...new Set(universities?.map((item: any) => item.university) || [])
      ]
      data = uniqueUniversities.map(name => ({ value: name, label: name }))
    } else if (field === 'subject') {
      // Get distinct subjects
      const { data: subjects, error } = await supabase
        .from('summaries')
        .select('subject')
        .not('subject', 'is', null)
        .ilike('subject', `%${query}%`)
        .eq('is_public', true)
        .limit(10)

      if (error) throw error

      const uniqueSubjects = [
        ...new Set(subjects?.map((item: any) => item.subject) || [])
      ]
      data = uniqueSubjects.map(name => ({ value: name, label: name }))
    } else if (field === 'course_name' || field === 'course_code') {
      // Get courses with their associated data
      const { data: courses, error } = await supabase
        .from('summaries')
        .select('course_code, course_name, subject')
        .not('course_code', 'is', null)
        .not('course_name', 'is', null)
        .or(
          field === 'course_name'
            ? `course_name.ilike.%${query}%`
            : `course_code.ilike.%${query}%`
        )
        .eq('is_public', true)
        .limit(10)

      if (error) throw error

      // Create unique course entries
      const uniqueCourses = new Map()
      courses?.forEach((course: any) => {
        const key = `${course.course_code}-${course.course_name}`
        if (!uniqueCourses.has(key)) {
          uniqueCourses.set(key, course)
        }
      })

      data = Array.from(uniqueCourses.values()).map(course => ({
        value:
          field === 'course_name' ? course.course_name : course.course_code,
        label:
          field === 'course_name' ? course.course_name : course.course_code,
        courseCode: course.course_code,
        courseName: course.course_name,
        subject: course.subject
      }))
    }

    return NextResponse.json({ suggestions: data })
  } catch (error) {
    logger.error('Autocomplete error', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}
