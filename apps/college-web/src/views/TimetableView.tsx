import React from 'react';
import { Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react';

export const TimetableView: React.FC = () => {
  const schedule = [
    { day: 'Monday', time: '09:00 - 10:00', code: 'CS501', subject: 'Operating Systems', room: 'LH-101', faculty: 'Prof. Vikram Sharma', type: 'Lecture' },
    { day: 'Monday', time: '10:15 - 11:15', code: 'CS502', subject: 'Database Management Systems', room: 'LH-101', faculty: 'Dr. Priya Nair', type: 'Lecture' },
    { day: 'Tuesday', time: '09:00 - 10:00', code: 'CS503', subject: 'Design & Analysis of Algorithms', room: 'LH-204', faculty: 'Dr. Aris Thorne', type: 'Lecture' },
    { day: 'Tuesday', time: '11:30 - 12:30', code: 'CS501', subject: 'Operating Systems', room: 'LH-101', faculty: 'Prof. Vikram Sharma', type: 'Lecture' },
    { day: 'Wednesday', time: '09:00 - 10:00', code: 'CS502', subject: 'Database Management Systems', room: 'LH-101', faculty: 'Dr. Priya Nair', type: 'Lecture' },
    { day: 'Wednesday', time: '11:00 - 13:00', code: 'CS504', subject: 'OS & DBMS Laboratory', room: 'CS-LAB3', faculty: 'Prof. Vikram Sharma', type: 'Practical Lab' },
    { day: 'Thursday', time: '09:00 - 10:00', code: 'CS503', subject: 'Design & Analysis of Algorithms', room: 'LH-204', faculty: 'Dr. Aris Thorne', type: 'Lecture' },
    { day: 'Friday', time: '10:15 - 11:15', code: 'CS501', subject: 'Operating Systems', room: 'LH-101', faculty: 'Prof. Vikram Sharma', type: 'Lecture' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academic Timetable Matrix</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Section A • 5th Semester • B.Tech Computer Science & Engineering
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
          const daySlots = schedule.filter((s) => s.day === day);
          return (
            <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-900 text-white px-4 py-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                <span>{day}</span>
                <span className="text-[10px] text-slate-400">{daySlots.length} Slots</span>
              </div>
              <div className="p-3 space-y-2.5 flex-1 bg-slate-50/50">
                {daySlots.map((slot, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-indigo-600">{slot.code}</span>
                      <span className="text-slate-400 font-mono">{slot.time}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">{slot.subject}</div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {slot.room}
                      </span>
                      <span className="text-slate-600 font-medium">{slot.faculty.split(' ')[1]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
