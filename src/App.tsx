import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Bell, BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, ClipboardList, CloudUpload, FileText, GraduationCap, Home,
  Inbox, LayoutDashboard, Menu, MoreHorizontal, Plus, Search, Settings,
  Users, X,
} from 'lucide-react'
import {
  courses, formatDate, formatDateLong, initialState, loadDemoState, modules,
  saveDemoState, tenants,
  type Assignment, type Course, type CourseTab, type DemoState, type Notice,
  type Role, type Section, type Submission, type TenantId,
} from './data'

type Icon = typeof Home
type NavigationItem = { id: Section; label: string; icon: Icon }

const navigation: NavigationItem[] = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { id: 'courses', label: 'Cursos', icon: BookOpen },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'inbox', label: 'Bandeja', icon: Inbox },
  { id: 'grades', label: 'Calificaciones', icon: GraduationCap },
]

const courseTabs: { id: CourseTab; label: string; icon: Icon }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'modules', label: 'Módulos', icon: BookOpen },
  { id: 'assignments', label: 'Tareas', icon: ClipboardList },
  { id: 'grades', label: 'Calificaciones', icon: GraduationCap },
  { id: 'people', label: 'Personas', icon: Users },
]

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function IconBadge({ icon: IconComponent, tone = 'blue' }: { icon: Icon; tone?: 'blue' | 'green' | 'orange' | 'purple' }) {
  return <span className={`icon-badge ${tone}`}><IconComponent size={20} strokeWidth={1.8} /></span>
}

function EmptyState({ icon: IconComponent, title, detail }: { icon: Icon; title: string; detail: string }) {
  return <div className="empty-state"><IconComponent size={30} strokeWidth={1.5} /><strong>{title}</strong><span>{detail}</span></div>
}

function Button({ children, onClick, secondary = false, type = 'button', disabled = false }: {
  children: ReactNode; onClick?: () => void; secondary?: boolean; type?: 'button' | 'submit'; disabled?: boolean
}) {
  return <button className={secondary ? 'button secondary' : 'button primary'} type={type} onClick={onClick} disabled={disabled}>{children}</button>
}

export default function App() {
  const [tenantId, setTenantId] = useState<TenantId>('utec')
  const [role, setRole] = useState<Role>('student')
  const [section, setSection] = useState<Section>('dashboard')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [courseTab, setCourseTab] = useState<CourseTab>('home')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [selectedModuleItemId, setSelectedModuleItemId] = useState<string | null>(null)
  const [state, setState] = useState<DemoState>(loadDemoState)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  const tenant = tenants.find((item) => item.id === tenantId)!
  const tenantCourses = useMemo(() => courses.filter((course) => course.tenantId === tenantId), [tenantId])
  const tenantAssignments = useMemo(() => state.assignments.filter((assignment) => assignment.tenantId === tenantId && (role === 'teacher' || assignment.published)), [state.assignments, tenantId, role])
  const tenantNotices = useMemo(() => state.notices.filter((notice) => notice.tenantId === tenantId && notice.role === role), [state.notices, tenantId, role])
  const selectedCourse = tenantCourses.find((course) => course.id === selectedCourseId) ?? null
  const selectedAssignment = tenantAssignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null
  const studentId = `demo-${tenantId}-student`
  const studentName = tenantId === 'utec' ? 'Valeria Mendoza' : 'Mateo Salazar'
  const userName = role === 'student' ? studentName : (tenantId === 'utec' ? 'Gerardo Colchado' : 'Ana Torres')
  const unreadCount = tenantNotices.filter((notice) => !notice.read).length

  useEffect(() => saveDemoState(state), [state])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  function changeTenant(id: TenantId) {
    setTenantId(id)
    setSelectedCourseId(null)
    setSelectedAssignmentId(null)
    setSelectedModuleItemId(null)
    setSection('dashboard')
    setSearch('')
  }

  function changeRole(nextRole: Role) {
    setRole(nextRole)
    setSelectedAssignmentId(null)
    setSelectedModuleItemId(null)
    setSection('dashboard')
  }

  function navigate(nextSection: Section) {
    setSection(nextSection)
    setSelectedCourseId(null)
    setSelectedAssignmentId(null)
    setSelectedModuleItemId(null)
    setMobileMenuOpen(false)
  }

  function openCourse(id: string, tab: CourseTab = 'home') {
    if (!tenantCourses.some((course) => course.id === id)) return
    setSelectedCourseId(id)
    setCourseTab(tab)
    setSelectedAssignmentId(null)
    setSelectedModuleItemId(null)
    setMobileMenuOpen(false)
  }

  function openAssignment(assignment: Assignment) {
    if (assignment.tenantId !== tenantId) return
    openCourse(assignment.courseId, 'assignments')
    setSelectedAssignmentId(assignment.id)
  }

  function addAssignment(input: { title: string; description: string; dueAt: string; points: number }) {
    if (!selectedCourse || role !== 'teacher') return
    const assignment: Assignment = {
      id: uid(), tenantId, courseId: selectedCourse.id, title: input.title,
      description: input.description, dueAt: input.dueAt, points: input.points, published: true,
    }
    const notice: Notice = {
      id: uid(), tenantId, role: 'student', title: 'Nueva tarea publicada',
      body: `${assignment.title} · ${selectedCourse.name}`, date: new Date().toISOString(), read: false,
    }
    setState((prev) => ({ ...prev, assignments: [assignment, ...prev.assignments], notices: [notice, ...prev.notices] }))
    setShowCreateAssignment(false)
    setToast('Tarea publicada en la demostración')
  }

  function submitAssignment(assignment: Assignment, text: string, fileName?: string) {
    if (role !== 'student' || assignment.tenantId !== tenantId || (!text.trim() && !fileName)) return
    const submission: Submission = {
      id: uid(), assignmentId: assignment.id, tenantId, studentId, studentName,
      text: text.trim(), fileName, submittedAt: new Date().toISOString(),
    }
    const notice: Notice = {
      id: uid(), tenantId, role: 'teacher', title: 'Nueva entrega recibida',
      body: `${studentName} entregó ${assignment.title}`, date: new Date().toISOString(), read: false,
    }
    setState((prev) => ({
      ...prev,
      submissions: [submission, ...prev.submissions.filter((item) => !(item.assignmentId === assignment.id && item.studentId === studentId))],
      notices: [notice, ...prev.notices],
    }))
    setToast('Entrega registrada en la demostración')
  }

  function gradeSubmission(submission: Submission, assignment: Assignment, grade: number, feedback: string) {
    if (role !== 'teacher' || assignment.tenantId !== tenantId || grade < 0 || grade > assignment.points) return
    const notice: Notice = {
      id: uid(), tenantId, role: 'student', title: 'Nueva calificación disponible',
      body: `${assignment.title}: ${grade} de ${assignment.points} puntos`, date: new Date().toISOString(), read: false,
    }
    setState((prev) => ({
      ...prev,
      submissions: prev.submissions.map((item) => item.id === submission.id ? { ...item, grade, feedback } : item),
      notices: [notice, ...prev.notices],
    }))
    setToast('Calificación guardada en la demostración')
  }

  function markAllRead() {
    setState((prev) => ({
      ...prev,
      notices: prev.notices.map((notice) => notice.tenantId === tenantId && notice.role === role ? { ...notice, read: true } : notice),
    }))
  }

  function resetDemo() {
    setState(initialState)
    setSelectedAssignmentId(null)
    setToast('Datos de demostración restablecidos')
  }

  const breadcrumbs = selectedCourse
    ? selectedAssignment ? [selectedCourse.name, 'Tareas', selectedAssignment.title]
      : selectedModuleItemId ? [selectedCourse.name, 'Módulos', 'Contenido']
        : [selectedCourse.name, courseTabs.find((tab) => tab.id === courseTab)?.label ?? 'Inicio']
    : [navigation.find((item) => item.id === section)?.label ?? 'Panel']

  return <div className="app-shell">
    <aside className={`global-nav ${mobileMenuOpen ? 'open' : ''}`} aria-label="Navegación global">
      <div className="brand" onClick={() => navigate('dashboard')} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') navigate('dashboard') }}>
        <div className="brand-mark">C<span>S</span></div>
        <div className="brand-name">Canva<span>SLS</span></div>
      </div>
      <div className="global-nav-items">
        {navigation.map(({ id, label, icon: IconComponent }) => <button key={id} className={`global-nav-item ${!selectedCourse && section === id ? 'active' : ''}`} onClick={() => navigate(id)}>
          <span className="nav-icon-wrap"><IconComponent size={22} strokeWidth={1.8} />{id === 'inbox' && unreadCount > 0 && <i className="nav-dot" />}</span>
          <span>{label}</span>
        </button>)}
      </div>
      <div className="global-nav-bottom">
        <button className="global-nav-item" onClick={resetDemo}><Settings size={22} strokeWidth={1.8} /><span>Reiniciar</span></button>
        <button className="global-nav-item" onClick={() => setToast('CanvaSLS · Vista de demostración')}><CircleHelp size={22} strokeWidth={1.8} /><span>Ayuda</span></button>
      </div>
    </aside>

    <div className="app-body">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Abrir menú"><Menu size={22} /></button>
        <div className="breadcrumbs"><button onClick={() => navigate('dashboard')}>Inicio</button>{breadcrumbs.map((crumb, index) => <span key={`${crumb}-${index}`}><ChevronRight size={15} /><b>{crumb}</b></span>)}</div>
        <div className="topbar-actions">
          <div className="search-box"><Search size={17} /><input aria-label="Buscar cursos" placeholder="Buscar cursos..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <button className="icon-button notification-button" aria-label="Ver notificaciones" onClick={() => navigate('inbox')}><Bell size={20} />{unreadCount > 0 && <i />}</button>
          <div className="avatar" title={userName}>{userName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
        </div>
      </header>

      <div className="context-bar">
        <div className="tenant-context"><span className="context-label">INSTITUCIÓN</span><label className="select-wrap"><select aria-label="Institución" value={tenantId} onChange={(event) => changeTenant(event.target.value as TenantId)}>{tenants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /></label></div>
        <div className="context-divider" />
        <div className="role-context"><span className="context-label">VISTA DE DEMO</span><div className="segmented" aria-label="Seleccionar rol"><button className={role === 'student' ? 'selected' : ''} onClick={() => changeRole('student')}>Alumno</button><button className={role === 'teacher' ? 'selected' : ''} onClick={() => changeRole('teacher')}>Profesor</button></div></div>
        <span className="demo-pill">Datos de demostración</span>
      </div>

      {selectedCourse ? <div className="course-layout">
        <aside className="course-sidebar">
          <button className="back-link" onClick={() => navigate('dashboard')}><ChevronLeft size={16} /> Volver al panel</button>
          <div className="course-sidebar-heading"><span>{selectedCourse.code}</span><strong>{selectedCourse.name}</strong></div>
          <nav aria-label="Navegación del curso">{courseTabs.map(({ id, label, icon: IconComponent }) => <button key={id} className={courseTab === id ? 'selected' : ''} onClick={() => { setCourseTab(id); setSelectedAssignmentId(null); setSelectedModuleItemId(null) }}><IconComponent size={17} />{label}</button>)}</nav>
        </aside>
        <main className="main-content course-content">
          {selectedAssignment ? <AssignmentDetail assignment={selectedAssignment} course={selectedCourse} role={role} studentId={studentId} submissions={state.submissions.filter((item) => item.tenantId === tenantId && item.assignmentId === selectedAssignment.id)} onBack={() => setSelectedAssignmentId(null)} onSubmit={submitAssignment} onGrade={gradeSubmission} />
            : selectedModuleItemId ? <ModuleDetail itemId={selectedModuleItemId} course={selectedCourse} onBack={() => setSelectedModuleItemId(null)} />
              : <CourseContent course={selectedCourse} tab={courseTab} role={role} assignments={tenantAssignments.filter((item) => item.courseId === selectedCourse.id)} submissions={state.submissions.filter((item) => item.tenantId === tenantId)} studentId={studentId} onOpenAssignment={openAssignment} onOpenModuleItem={setSelectedModuleItemId} onCreateAssignment={() => setShowCreateAssignment(true)} />}
        </main>
      </div> : <main className="main-content root-content">
        {section === 'dashboard' && <Dashboard tenant={tenant.shortName} role={role} userName={userName} courseList={tenantCourses.filter((course) => `${course.name} ${course.code}`.toLowerCase().includes(search.toLowerCase()))} assignments={tenantAssignments} notices={tenantNotices} submissions={state.submissions.filter((item) => item.tenantId === tenantId)} studentId={studentId} onCourse={openCourse} onAssignment={openAssignment} onNavigate={navigate} />}
        {section === 'courses' && <CoursesView courseList={tenantCourses.filter((course) => `${course.name} ${course.code}`.toLowerCase().includes(search.toLowerCase()))} onCourse={openCourse} />}
        {section === 'calendar' && <CalendarView assignments={tenantAssignments} onAssignment={openAssignment} />}
        {section === 'inbox' && <InboxView notices={tenantNotices} onMarkAllRead={markAllRead} />}
        {section === 'grades' && <GradesView role={role} assignments={tenantAssignments} submissions={state.submissions.filter((item) => item.tenantId === tenantId)} studentId={studentId} onAssignment={openAssignment} />}
      </main>}
    </div>

    {showCreateAssignment && selectedCourse && <CreateAssignmentModal course={selectedCourse} onClose={() => setShowCreateAssignment(false)} onCreate={addAssignment} />}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
    {mobileMenuOpen && <button className="mobile-scrim" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />}
  </div>
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>
}

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  return <button className="course-card" onClick={onClick}>
    <div className="course-card-art" style={{ '--course-color': course.color } as React.CSSProperties}><span className="course-art-ring one" /><span className="course-art-ring two" /><span className="course-code-badge">{course.code}</span></div>
    <div className="course-card-body"><div className="course-card-title-row"><strong>{course.name}</strong><MoreHorizontal size={19} /></div><span className="muted">{course.professor}</span><div className="course-card-meta"><span>{course.term}</span><span>{course.progress}% completado</span></div><div className="progress-track"><span style={{ width: `${course.progress}%`, backgroundColor: course.color }} /></div></div>
  </button>
}

function Dashboard({ tenant, role, userName, courseList, assignments, notices, submissions, studentId, onCourse, onAssignment, onNavigate }: {
  tenant: string; role: Role; userName: string; courseList: Course[]; assignments: Assignment[]; notices: Notice[]; submissions: Submission[]; studentId: string;
  onCourse: (id: string, tab?: CourseTab) => void; onAssignment: (assignment: Assignment) => void; onNavigate: (section: Section) => void
}) {
  const pending = assignments.filter((assignment) => !submissions.some((submission) => submission.assignmentId === assignment.id && submission.studentId === studentId))
  const graded = submissions.filter((submission) => submission.studentId === studentId && submission.grade !== undefined).length
  return <>
    <PageHeading eyebrow={`ESPACIO ACADÉMICO · ${tenant}`} title={`Hola, ${userName.split(' ')[0]} 👋`} subtitle={role === 'student' ? 'Aquí tienes un resumen de tus cursos y próximas actividades.' : 'Administra tus cursos y revisa la actividad de tus estudiantes.'} />
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section className="summary-grid">
          <div className="summary-card"><IconBadge icon={BookOpen} tone="blue" /><div><strong>{courseList.length}</strong><span>Cursos activos</span></div></div>
          <div className="summary-card"><IconBadge icon={ClipboardList} tone="orange" /><div><strong>{role === 'student' ? pending.length : assignments.length}</strong><span>{role === 'student' ? 'Tareas pendientes' : 'Tareas publicadas'}</span></div></div>
          <div className="summary-card"><IconBadge icon={role === 'student' ? GraduationCap : Users} tone="green" /><div><strong>{role === 'student' ? graded : courseList.reduce((sum, course) => sum + course.students, 0)}</strong><span>{role === 'student' ? 'Notas disponibles' : 'Estudiantes'}</span></div></div>
        </section>
        <section className="section-block"><div className="section-heading"><div><h2>Mis cursos</h2><p>Continúa donde te quedaste</p></div><button className="text-link" onClick={() => onNavigate('courses')}>Ver todos <ChevronRight size={16} /></button></div><div className="course-grid">{courseList.length ? courseList.map((course) => <CourseCard key={course.id} course={course} onClick={() => onCourse(course.id)} />) : <EmptyState icon={BookOpen} title="Sin cursos" detail="No hay cursos que coincidan con tu búsqueda." />}</div></section>
        <section className="section-block"><div className="section-heading"><div><h2>Próximas tareas</h2><p>Actividades de tus cursos</p></div><button className="text-link" onClick={() => onNavigate('calendar')}>Ver calendario <ChevronRight size={16} /></button></div><div className="panel-list">{assignments.length ? assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 4).map((assignment) => { const course = courses.find((item) => item.id === assignment.courseId)!; const submitted = submissions.some((item) => item.assignmentId === assignment.id && item.studentId === studentId); return <button key={assignment.id} className="assignment-row" onClick={() => onAssignment(assignment)}><span className="date-tile"><b>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { day: '2-digit', timeZone: 'America/Lima' })}</b><small>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { month: 'short', timeZone: 'America/Lima' })}</small></span><span className="assignment-row-main"><strong>{assignment.title}</strong><small>{course.name} · {assignment.points} puntos</small></span><span className={`status-pill ${submitted ? 'success' : ''}`}>{submitted ? 'Entregada' : role === 'student' ? 'Pendiente' : 'Publicada'}</span><ChevronRight size={18} className="row-chevron" /></button> }) : <EmptyState icon={ClipboardList} title="Sin tareas" detail="Las tareas publicadas aparecerán aquí." />}</div></section>
      </div>
      <aside className="dashboard-aside"><div className="aside-panel"><div className="aside-heading"><span className="aside-icon"><CalendarDays size={18} /></span><h3>Para esta semana</h3></div><p className="aside-description">Mantente al día con lo que viene.</p>{assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 3).map((assignment) => <button className="aside-task" key={assignment.id} onClick={() => onAssignment(assignment)}><span className="aside-task-dot" /><span><strong>{assignment.title}</strong><small>Entrega: {formatDate(assignment.dueAt)}</small></span></button>)}{assignments.length === 0 && <span className="muted">No hay tareas próximas.</span>}</div><div className="aside-panel"><div className="aside-heading"><span className="aside-icon purple"><Bell size={18} /></span><h3>Actividad reciente</h3></div>{notices.slice(0, 3).map((notice) => <div className="activity-item" key={notice.id}><span className="activity-dot" /><div><strong>{notice.title}</strong><p>{notice.body}</p></div></div>)}{notices.length === 0 && <span className="muted">No hay actividad reciente.</span>}<button className="text-link aside-link" onClick={() => onNavigate('inbox')}>Ver bandeja <ChevronRight size={16} /></button></div></aside>
    </div>
  </>
}

function CoursesView({ courseList, onCourse }: { courseList: Course[]; onCourse: (id: string) => void }) {
  return <><PageHeading eyebrow="APRENDIZAJE" title="Mis cursos" subtitle="Explora los cursos de tu institución." /><div className="course-grid all-courses">{courseList.map((course) => <CourseCard key={course.id} course={course} onClick={() => onCourse(course.id)} />)}{courseList.length === 0 && <EmptyState icon={BookOpen} title="Sin cursos" detail="No hay cursos que coincidan con tu búsqueda." />}</div></>
}

function CourseContent({ course, tab, role, assignments, submissions, studentId, onOpenAssignment, onOpenModuleItem, onCreateAssignment }: {
  course: Course; tab: CourseTab; role: Role; assignments: Assignment[]; submissions: Submission[]; studentId: string;
  onOpenAssignment: (assignment: Assignment) => void; onOpenModuleItem: (id: string) => void; onCreateAssignment: () => void
}) {
  const courseModules = modules.filter((module) => module.courseId === course.id)
  if (tab === 'home') return <><PageHeading eyebrow={`${course.code} · ${course.term}`} title={course.name} subtitle={`Profesor: ${course.professor}`} /><div className="course-hero" style={{ '--course-color': course.color } as React.CSSProperties}><div><span>BIENVENIDO AL CURSO</span><h2>{course.name}</h2><p>Encuentra aquí tus módulos, tareas y calificaciones.</p></div><BookOpen size={112} strokeWidth={0.8} /></div><div className="course-home-grid"><div className="content-card"><div className="section-heading compact"><div><h2>Contenido del curso</h2><p>Materiales y recursos</p></div></div>{courseModules.length ? courseModules.map((module) => <div className="mini-module" key={module.id}><IconBadge icon={BookOpen} /><div><strong>{module.title}</strong><small>{module.items.length} elementos</small></div></div>) : <EmptyState icon={BookOpen} title="Contenido en preparación" detail="Pronto aparecerán los módulos del curso." />}</div><div className="content-card"><div className="section-heading compact"><div><h2>Próximas entregas</h2><p>Actividades pendientes</p></div></div>{assignments.length ? assignments.slice(0, 3).map((assignment) => <button className="compact-task" key={assignment.id} onClick={() => onOpenAssignment(assignment)}><FileText size={18} /><span><strong>{assignment.title}</strong><small>Hasta el {formatDate(assignment.dueAt)}</small></span><ChevronRight size={16} /></button>) : <EmptyState icon={ClipboardList} title="Sin tareas" detail="Todavía no hay tareas publicadas." />}</div></div></>
  if (tab === 'modules') return <><PageHeading eyebrow={course.code} title="Módulos" subtitle="Material de aprendizaje organizado por temas." />{courseModules.length ? courseModules.map((module, index) => <div className="module-panel" key={module.id}><div className="module-header"><span className="module-number">{String(index + 1).padStart(2, '0')}</span><h2>{module.title}</h2><span className="muted">{module.items.length} elementos</span></div>{module.items.map((item) => <button className="module-item" key={item.id} onClick={() => onOpenModuleItem(item.id)}><span className={`module-item-icon ${item.type}`}><FileText size={17} /></span><span>{item.title}</span><ChevronRight size={17} /></button>)}</div>) : <EmptyState icon={BookOpen} title="Sin módulos" detail="El contenido de este curso aún está en preparación." />}</>
  if (tab === 'assignments') return <><PageHeading eyebrow={course.code} title="Tareas" subtitle={role === 'teacher' ? 'Publica y revisa las actividades del curso.' : 'Consulta las consignas y entrega tu trabajo.'} action={role === 'teacher' && <Button onClick={onCreateAssignment}><Plus size={17} /> Nueva tarea</Button>} /><div className="content-card task-list">{assignments.length ? assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((assignment) => { const submission = submissions.find((item) => item.assignmentId === assignment.id && item.studentId === studentId); return <button className="task-list-row" key={assignment.id} onClick={() => onOpenAssignment(assignment)}><IconBadge icon={ClipboardList} tone="orange" /><span className="task-list-main"><strong>{assignment.title}</strong><small>Vence el {formatDateLong(assignment.dueAt)} · {assignment.points} puntos</small></span><span className={`status-pill ${submission ? 'success' : ''}`}>{role === 'teacher' ? `${submissions.filter((item) => item.assignmentId === assignment.id).length} entregas` : submission ? 'Entregada' : 'Pendiente'}</span><ChevronRight size={18} /></button> }) : <EmptyState icon={ClipboardList} title="Sin tareas" detail="Las tareas del curso aparecerán aquí." />}</div></>
  if (tab === 'grades') return <><PageHeading eyebrow={course.code} title="Calificaciones" subtitle={role === 'teacher' ? 'Revisa las calificaciones de este curso.' : 'Consulta tus resultados.'} /><GradeTable assignments={assignments} submissions={submissions} role={role} studentId={studentId} onAssignment={onOpenAssignment} /></>
  return <><PageHeading eyebrow={course.code} title="Personas" subtitle="Participantes del curso." /><div className="content-card people-card"><IconBadge icon={Users} tone="purple" /><div><h2>{course.students} estudiantes matriculados</h2><p>Profesor responsable: {course.professor}</p><p className="muted">La lista completa de matrículas se conectará al servicio académico.</p></div></div></>
}

function ModuleDetail({ itemId, course, onBack }: { itemId: string; course: Course; onBack: () => void }) {
  const item = modules.flatMap((module) => module.items).find((entry) => entry.id === itemId)
  if (!item) return null
  return <><button className="back-link inline" onClick={onBack}><ChevronLeft size={16} /> Volver a módulos</button><PageHeading eyebrow={course.code} title={item.title} subtitle={item.type === 'assignment' ? 'Actividad del curso' : 'Material del curso'} /><div className="content-card article-card"><IconBadge icon={FileText} /><h2>{item.title}</h2><p>{item.description ?? 'Este elemento forma parte del contenido de demostración. Su contenido se cargará desde el servicio de contenidos.'}</p></div></>
}

function AssignmentDetail({ assignment, course, role, studentId, submissions, onBack, onSubmit, onGrade }: {
  assignment: Assignment; course: Course; role: Role; studentId: string; submissions: Submission[];
  onBack: () => void; onSubmit: (assignment: Assignment, text: string, fileName?: string) => void;
  onGrade: (submission: Submission, assignment: Assignment, grade: number, feedback: string) => void
}) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | undefined>()
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')
  const ownSubmission = submissions.find((item) => item.studentId === studentId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(assignment, text, fileName)
    setText('')
    setFileName(undefined)
  }

  function handleGrade(event: FormEvent, submission: Submission) {
    event.preventDefault()
    const number = Number(grade)
    if (!grade.trim() || !Number.isFinite(number)) return
    onGrade(submission, assignment, number, feedback)
    setGrade('')
    setFeedback('')
  }

  return <><button className="back-link inline" onClick={onBack}><ChevronLeft size={16} /> Volver a tareas</button><PageHeading eyebrow={`${course.code} · TAREA`} title={assignment.title} subtitle={`Entrega hasta el ${formatDateLong(assignment.dueAt)}`} /><div className="detail-layout"><div className="detail-main"><div className="content-card article-card"><div className="detail-meta"><span><CalendarDays size={16} /> {formatDateLong(assignment.dueAt)}</span><span><GraduationCap size={17} /> {assignment.points} puntos</span></div><h2>Instrucciones</h2><p>{assignment.description}</p></div>{role === 'student' ? <div className="content-card form-card"><div className="section-heading compact"><div><h2>Tu entrega</h2><p>{ownSubmission ? `Entregada el ${formatDateLong(ownSubmission.submittedAt)}` : 'Envía tu trabajo para revisión.'}</p></div>{ownSubmission && <span className="status-pill success">Entregada</span>}</div>{ownSubmission ? <div className="submitted-box"><Check size={19} /><div><strong>Entrega recibida</strong><p>{ownSubmission.text || ownSubmission.fileName}</p>{ownSubmission.fileName && <small>Archivo seleccionado: {ownSubmission.fileName}</small>}</div></div> : <form onSubmit={handleSubmit}><label className="field-label" htmlFor="submission-text">Respuesta escrita</label><textarea id="submission-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escribe tu respuesta o una nota para el profesor..." rows={5} /><label className="upload-zone"><CloudUpload size={23} /><span>{fileName ?? 'Seleccionar archivo'}</span><small>En esta demo se guarda el nombre; el archivo se subirá a S3 al conectar la API.</small><input type="file" onChange={(event) => setFileName(event.target.files?.[0]?.name)} /></label><Button type="submit" disabled={!text.trim() && !fileName}>Enviar entrega</Button></form>}</div> : <div className="content-card form-card"><div className="section-heading compact"><div><h2>Entregas de alumnos</h2><p>{submissions.length} entrega{submissions.length === 1 ? '' : 's'} recibida{submissions.length === 1 ? '' : 's'}</p></div></div>{submissions.length ? submissions.map((submission) => <div className="review-card" key={submission.id}><div className="review-header"><span className="small-avatar">{submission.studentName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{submission.studentName}</strong><small>Entregó el {formatDateLong(submission.submittedAt)}</small></div>{submission.grade !== undefined && <span className="status-pill success">{submission.grade}/{assignment.points}</span>}</div><p>{submission.text || 'Entrega con archivo adjunto.'}</p>{submission.fileName && <span className="file-chip"><FileText size={15} />{submission.fileName}</span>}{submission.grade !== undefined && <div className="feedback-box"><strong>Comentario</strong><p>{submission.feedback || 'Sin comentario.'}</p></div>}{submission.grade === undefined && <form className="grade-form" onSubmit={(event) => handleGrade(event, submission)}><label className="field-label" htmlFor={`grade-${submission.id}`}>Calificación (0–{assignment.points})</label><input id={`grade-${submission.id}`} type="number" min="0" max={assignment.points} step="0.1" required value={grade} onChange={(event) => setGrade(event.target.value)} /><label className="field-label" htmlFor={`feedback-${submission.id}`}>Comentario</label><textarea id={`feedback-${submission.id}`} rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Escribe un comentario para el alumno..." /><Button type="submit">Publicar nota</Button></form>}</div>) : <EmptyState icon={Inbox} title="Aún no hay entregas" detail="Las entregas de tus estudiantes aparecerán aquí." />}</div>}</div><aside className="detail-aside"><div className="aside-panel"><h3>Detalles de la tarea</h3><div className="detail-fact"><span>Curso</span><strong>{course.name}</strong></div><div className="detail-fact"><span>Fecha límite</span><strong>{formatDate(assignment.dueAt)}</strong></div><div className="detail-fact"><span>Puntos</span><strong>{assignment.points}</strong></div><div className="detail-fact"><span>Estado</span><strong>{role === 'student' ? ownSubmission ? 'Entregada' : 'Pendiente' : 'Publicada'}</strong></div></div>{ownSubmission?.grade !== undefined && <div className="aside-panel grade-highlight"><span>TU CALIFICACIÓN</span><strong>{ownSubmission.grade}<small> / {assignment.points}</small></strong><p>{ownSubmission.feedback || 'Sin comentarios del profesor.'}</p></div>}</aside></div></>
}

function CreateAssignmentModal({ course, onClose, onCreate }: { course: Course; onClose: () => void; onCreate: (input: { title: string; description: string; dueAt: string; points: number }) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [points, setPoints] = useState('20')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || !dueAt || !points) return
    onCreate({ title: title.trim(), description: description.trim(), dueAt: new Date(dueAt).toISOString(), points: Number(points) })
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{course.code}</span><h2 id="modal-title">Nueva tarea</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div><form onSubmit={submit}><label className="field-label" htmlFor="new-title">Título</label><input id="new-title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Entrega del proyecto" /><label className="field-label" htmlFor="new-description">Instrucciones</label><textarea id="new-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe lo que deben entregar los alumnos..." /><div className="form-two-columns"><div><label className="field-label" htmlFor="new-due">Fecha límite</label><input id="new-due" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div><div><label className="field-label" htmlFor="new-points">Puntos</label><input id="new-points" type="number" min="1" max="100" required value={points} onChange={(event) => setPoints(event.target.value)} /></div></div><div className="modal-actions"><Button secondary onClick={onClose}>Cancelar</Button><Button type="submit">Publicar tarea</Button></div></form></div></div>
}

function CalendarView({ assignments, onAssignment }: { assignments: Assignment[]; onAssignment: (assignment: Assignment) => void }) {
  const ordered = assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return <><PageHeading eyebrow="PLANIFICACIÓN" title="Calendario" subtitle="Fechas importantes de tus cursos." /><div className="content-card calendar-list"><div className="calendar-list-title"><CalendarDays size={21} /><h2>Próximas entregas</h2></div>{ordered.length ? ordered.map((assignment) => <button className="calendar-item" key={assignment.id} onClick={() => onAssignment(assignment)}><span className="date-tile"><b>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { day: '2-digit', timeZone: 'America/Lima' })}</b><small>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { month: 'short', timeZone: 'America/Lima' })}</small></span><span><strong>{assignment.title}</strong><small>{courses.find((course) => course.id === assignment.courseId)?.name} · {formatDateLong(assignment.dueAt)}</small></span><ChevronRight size={17} /></button>) : <EmptyState icon={CalendarDays} title="Sin eventos" detail="Las fechas de tus tareas aparecerán aquí." />}</div></>
}

function InboxView({ notices, onMarkAllRead }: { notices: Notice[]; onMarkAllRead: () => void }) {
  return <><PageHeading eyebrow="COMUNICACIÓN" title="Bandeja" subtitle="Avisos de tus cursos." action={<Button secondary onClick={onMarkAllRead}><Check size={17} /> Marcar como leídos</Button>} /><div className="content-card inbox-list">{notices.length ? notices.map((notice) => <div className={`inbox-item ${notice.read ? '' : 'unread'}`} key={notice.id}><span className="inbox-icon"><Bell size={18} /></span><div><strong>{notice.title}</strong><p>{notice.body}</p><small>{formatDateLong(notice.date)}</small></div>{!notice.read && <span className="unread-dot" />}</div>) : <EmptyState icon={Inbox} title="Bandeja vacía" detail="Los avisos de tus cursos aparecerán aquí." />}</div></>
}

function GradesView({ role, assignments, submissions, studentId, onAssignment }: { role: Role; assignments: Assignment[]; submissions: Submission[]; studentId: string; onAssignment: (assignment: Assignment) => void }) {
  return <><PageHeading eyebrow="SEGUIMIENTO" title="Calificaciones" subtitle={role === 'student' ? 'Consulta tus resultados por actividad.' : 'Consulta y revisa las calificaciones publicadas.'} /><GradeTable role={role} assignments={assignments} submissions={submissions} studentId={studentId} onAssignment={onAssignment} /></>
}

function GradeTable({ role, assignments, submissions, studentId, onAssignment }: { role: Role; assignments: Assignment[]; submissions: Submission[]; studentId: string; onAssignment: (assignment: Assignment) => void }) {
  return <div className="content-card grade-table"><div className="table-head"><span>TAREA</span><span>CURSO</span><span>ESTADO</span><span>NOTA</span></div>{assignments.length ? assignments.map((assignment) => { const related = submissions.filter((item) => item.assignmentId === assignment.id && (role === 'teacher' || item.studentId === studentId)); const submission = related[0]; return <button className="table-row" key={assignment.id} onClick={() => onAssignment(assignment)}><span><strong>{assignment.title}</strong><small>{formatDate(assignment.dueAt)}</small></span><span>{courses.find((course) => course.id === assignment.courseId)?.name}</span><span><span className={`status-pill ${submission?.grade !== undefined ? 'success' : ''}`}>{submission?.grade !== undefined ? 'Calificada' : submission ? 'Entregada' : 'Pendiente'}</span></span><span><strong>{submission?.grade !== undefined ? `${submission.grade} / ${assignment.points}` : '—'}</strong></span></button> }) : <EmptyState icon={GraduationCap} title="Sin calificaciones" detail="Las calificaciones aparecerán aquí." />}</div>
}
