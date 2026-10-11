package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Protein;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProteinRepository extends JpaRepository<Protein, Long> {
    // 목록에 작성자 닉네임을 쓰므로 작성자를 같이 가져온다(글마다 추가 조회 방지)
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"owner"})
    Page<Protein> findByNameContainingIgnoreCase(String name, Pageable pageable);

    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"owner"})
    Page<Protein> findAll(Pageable pageable);
}
