package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Inquiry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InquiryRepository extends JpaRepository<Inquiry, Long> {
}

