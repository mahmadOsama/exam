/* =====================================
   DATABASE OPERATIONS & SUPABASE CONFIG
   ===================================== */

let SUPABASE_URL;
let SUPABASE_ANON_KEY;

// Always load the example config so GitHub Pages never requests ./config.js
// (Pages may log 404 if config.js is missing; this prevents it.)
{
    const mod = await import('../config.example.js');
    SUPABASE_URL = mod.SUPABASE_URL;
    SUPABASE_ANON_KEY = mod.SUPABASE_ANON_KEY;
}




export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



/* ===== EXAMS ===== */
export async function getExams() {
    const { data, error } = await supabase
        .from('exams')
        .select(`
            *,
            subjects(id, name, language)
        `)
        .order('created_at', { ascending: false });

    if (error) console.error('Error fetching exams:', error);
    return data || [];
}

export async function getExamById(examId) {
    const { data, error } = await supabase
        .from('exams')
        .select(`
            *,
            subjects(id, name, language)
        `)
        .eq('id', examId)
        .single();

    if (error) console.error('Error fetching exam:', error);
    return data;
}

export async function createExam(examData) {
    const { data, error } = await supabase
        .from('exams')
        .insert(examData)
        .select()
        .single();

    if (error) console.error('Error creating exam:', error);
    return { data, error };
}

export async function updateExam(examId, updates) {
    const { data, error } = await supabase
        .from('exams')
        .update(updates)
        .eq('id', examId)
        .select()
        .single();

    if (error) console.error('Error updating exam:', error);
    return { data, error };
}

export async function deleteExam(examId) {
    // Delete related data first
    await supabase.from('student_answers').delete().eq('exam_id', examId);
    await supabase.from('exam_submissions').delete().eq('exam_id', examId);
    await supabase.from('questions').delete().eq('exam_id', examId);

    const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

    if (error) console.error('Error deleting exam:', error);
    return { error };
}

/* ===== QUESTIONS ===== */
export async function getExamQuestions(examId) {
    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('question_order', { ascending: true });

    if (error) console.error('Error fetching questions:', error);
    return data || [];
}

export async function createQuestion(questionData) {
    const { data, error } = await supabase
        .from('questions')
        .insert(questionData)
        .select()
        .single();

    if (error) console.error('Error creating question:', error);
    return { data, error };
}

export async function updateQuestion(questionId, updates) {
    const { data, error } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', questionId)
        .select()
        .single();

    if (error) console.error('Error updating question:', error);
    return { data, error };
}

export async function deleteQuestion(questionId) {
    const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

    if (error) console.error('Error deleting question:', error);
    return { error };
}

/* ===== USERS/STUDENTS ===== */
export async function getStudents() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

    if (error) console.error('Error fetching students:', error);
    return data || [];
}

export async function getStudentById(studentId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', studentId)
        .single();

    if (error) console.error('Error fetching student:', error);
    return data;
}

export async function createStudent(studentData) {
    const { data, error } = await supabase
        .from('users')
        .insert({
            ...studentData,
            role: 'student',
            is_active: true
        })
        .select()
        .single();

    if (error) console.error('Error creating student:', error);
    return { data, error };
}

export async function updateStudent(studentId, updates) {
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', studentId)
        .select()
        .single();

    if (error) console.error('Error updating student:', error);
    return { data, error };
}

export async function deleteStudent(studentId) {
    // Soft delete - disable account
    const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', studentId);

    if (error) console.error('Error deleting student:', error);
    return { error };
}

/* ===== EXAM SUBMISSIONS ===== */
export async function getSubmissions(filters = {}) {
    let query = supabase
        .from('exam_submissions')
        .select(`
            *,
            users(id, username, full_name),
            exams(id, title, subjects(name))
        `);

    if (filters.examId) {
        query = query.eq('exam_id', filters.examId);
    }

    if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
    }

    if (filters.isSubmitted !== undefined) {
        query = query.eq('is_submitted', filters.isSubmitted);
    }

    const { data, error } = await query.order('start_time', { ascending: false });

    if (error) {
        console.error('Error fetching submissions:', error);
        return [];
    }
    return data || [];
}

export async function getSubmissionById(submissionId) {
    const { data, error } = await supabase
        .from('exam_submissions')
        .select(`
            *,
            users(id, username, full_name),
            exams(id, title, subjects(name))
        `)
        .eq('id', submissionId)
        .single();

    if (error) console.error('Error fetching submission:', error);
    return data;
}

export async function getStudentGrades(studentId) {
    const { data, error } = await supabase
        .from('exam_submissions')
        .select(`
            *,
            exams(id, title, subjects(name))
        `)
        .eq('student_id', studentId)
        .eq('is_submitted', true)
        .order('start_time', { ascending: false });

    if (error) {
        console.error('Error fetching grades:', error);
        return [];
    }
    return data || [];
}

export async function createSubmission(submissionData) {
    const { data, error } = await supabase
        .from('exam_submissions')
        .insert(submissionData)
        .select()
        .single();

    if (error) {
        // 23505 = unique constraint violation (duplicate submission already exists)
        if (error.code === '23505') {
            const { data: existing, error: fetchError } = await supabase
                .from('exam_submissions')
                .select('*')
                .eq('exam_id', submissionData.exam_id)
                .eq('student_id', submissionData.student_id)
                .single();

            if (!fetchError && existing) {
                return { data: existing, error: null };
            }
        }
        console.error('Error creating submission:', error);
    }

    return { data, error };
}

export async function updateSubmission(submissionId, updates) {
    const { data, error } = await supabase
        .from('exam_submissions')
        .update(updates)
        .eq('id', submissionId)
        .select()
        .single();

    if (error) console.error('Error updating submission:', error);
    return { data, error };
}

/* ===== STUDENT ANSWERS ===== */
export async function getAnswers(submissionId) {
    const { data, error } = await supabase
        .from('student_answers')
        .select(`
            *,
            questions(id, content, correct_answer, question_type, points)
        `)
        .eq('submission_id', submissionId);

    if (error) console.error('Error fetching answers:', error);
    return data || [];
}

export async function saveAnswer(answerData) {
    const { data, error } = await supabase
        .from('student_answers')
        .upsert(answerData, {
            onConflict: 'submission_id,question_id'
        })
        .select()
        .single();

    if (error) console.error('Error saving answer:', error);
    return { data, error };
}

export async function updateAnswer(answerId, updates) {
    const { data, error } = await supabase
        .from('student_answers')
        .update(updates)
        .eq('id', answerId)
        .select()
        .single();

    if (error) console.error('Error updating answer:', error);
    return { data, error };
}

/* ===== SUBJECTS ===== */
export async function getSubjects() {
    const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true });

    if (error) console.error('Error fetching subjects:', error);
    return data || [];
}

export async function getSubjectByName(name) {
    const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('name', name)
        .single();

    if (error) console.error('Error fetching subject:', error);
    return data;
}

export async function createSubject(subjectData) {
    const { data, error } = await supabase
        .from('subjects')
        .insert(subjectData)
        .select()
        .single();

    if (error) console.error('Error creating subject:', error);
    return { data, error };
}

/* ===== GRADING ===== */
function normalizeAnswer(v) {
    return (v ?? '').toString().trim().toLowerCase();
}

export async function autoGradeSubmission(submissionId) {
    const answers = await getAnswers(submissionId);
    let totalScore = 0;

    for (const answer of answers) {
        const isCorrect = normalizeAnswer(answer.answer) === normalizeAnswer(answer.questions?.correct_answer);
        
        const pointsAwarded = isCorrect ? answer.questions?.points || 0 : 0;
        totalScore += pointsAwarded;

        await updateAnswer(answer.id, {
            is_correct: isCorrect,
            points_awarded: pointsAwarded
        });
    }

    await updateSubmission(submissionId, {
        score: totalScore
    });

    return totalScore;
}

// Grade a single student answer row, using the same logic as `autoGradeSubmission`.
// Then recompute the submission total score.
export async function autoGradeSingleAnswer(answerId, submissionId) {
    const answers = await getAnswers(submissionId);
    const answer = answers.find(a => a.id === answerId);
    if (!answer) {
        throw new Error('Answer not found');
    }

    const isCorrect = normalizeAnswer(answer.answer) === normalizeAnswer(answer.questions?.correct_answer);
    const pointsAwarded = isCorrect ? (answer.questions?.points || 0) : 0;

    await updateAnswer(answerId, {
        is_correct: isCorrect,
        points_awarded: pointsAwarded
    });

    // Recompute total score for the whole submission (ensures “added to original mark” behavior)
    const updatedAnswers = await getAnswers(submissionId);
    const totalScore = updatedAnswers.reduce((sum, a) => sum + (a.points_awarded ?? 0), 0);

    await updateSubmission(submissionId, {
        score: totalScore
    });

    return { totalScore, isCorrect, pointsAwarded };
}


// export async function getStudentGrades(studentId) {
//     const { data, error } = await supabase
//         .from('exam_submissions')
//         .select(`
//             *,
//             exams(id, title, subjects(name))
//         `)
//         .eq('student_id', studentId)
//         .eq('is_submitted', true)
//         .order('created_at', { ascending: false });

//     if (error) console.error('Error fetching grades:', error);
//     return data || [];
// }

/* ===== ANALYTICS ===== */
export async function getExamAnalytics(examId) {
    const submissions = await getSubmissions({ examId, isSubmitted: true });
    
    if (!submissions.length) {
        return {
            totalStudents: 0,
            completedSubmissions: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            passRate: 0
        };
    }

    const scores = submissions.map(s => s.score || 0);
    const passCount = scores.filter(s => s >= 50).length;

    return {
        totalStudents: submissions.length,
        completedSubmissions: submissions.filter(s => s.is_submitted).length,
        averageScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        passRate: ((passCount / scores.length) * 100).toFixed(2)
    };
}

export async function getStudentAnalytics(studentId) {
    const submissions = await getStudentGrades(studentId);

    if (!submissions.length) {
        return {
            totalExams: 0,
            completedExams: 0,
            averageScore: 0,
            passedExams: 0,
            failedExams: 0
        };
    }

    const scores = submissions.map(s => s.score || 0);
    const passedCount = scores.filter(s => s >= 50).length;

    return {
        totalExams: submissions.length,
        completedExams: submissions.filter(s => s.is_submitted).length,
        averageScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
        passedExams: passedCount,
        failedExams: submissions.length - passedCount
    };
}