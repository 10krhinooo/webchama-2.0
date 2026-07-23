package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import org.chama.domain.enums.AttendanceStatus;

public record RecordAttendanceDto(@NotNull AttendanceStatus status) {
}
